"""
Rotas de membership - Gerenciar participação em sistemas.

Endpoints:
- GET  /api/user/tenants - Listar meus sistemas
- POST /api/user/tenants/join - Entrar em um sistema
- DELETE /api/user/tenants/:id - Sair de um sistema
- GET  /api/tenants/available - Sistemas disponíveis para inscrição
- GET  /api/tenants/:slug - Detalhes de um sistema
"""
from __future__ import annotations

import json
import os
import traceback
from typing import Any, Dict
from urllib.request import Request, urlopen

from flask import Blueprint, g, jsonify, request
from sqlalchemy import create_engine, text

from app.db import (
    execute_sql, fetch_all, fetch_one, safe_db_error,
    build_tenant_database_url, TENANT_DB_HOST,
)
from app.routes.auth_routes import login_required

membership_bp = Blueprint("membership", __name__)

ENV = os.getenv("ENV", "dev")

# Sistemas que auto-aprovam (não precisam de aprovação do admin)
AUTO_APPROVE_SYSTEMS = {"quadra"}


def _notify_tenant_admins_push(tenant, user_name: str, message: str):
    """
    Envia push notification para os admins do tenant quando alguém solicita acesso.
    Busca push_tokens direto do banco do tenant.
    """
    try:
        tenant_id = tenant["id"]
        db_name = tenant.get("database_name")
        db_host = tenant.get("database_host") or TENANT_DB_HOST

        if not db_name:
            print(f"[push-join] Tenant {tenant_id} sem database_name, skip")
            return

        # 1) Buscar user_ids dos admins deste tenant no hub
        admins = fetch_all(
            """
            SELECT user_id FROM user_tenants
            WHERE tenant_id = :tenant_id AND role = 'admin' AND is_active = TRUE
            """,
            {"tenant_id": tenant_id},
        )
        if not admins:
            print(f"[push-join] Nenhum admin ativo no tenant {tenant_id}")
            return

        admin_hub_ids = [a["user_id"] for a in admins]
        print(f"[push-join] Admins do hub para tenant {tenant_id}: {admin_hub_ids}")

        # 2) Para cada admin do hub, buscar fk_id_user_hub no banco do tenant
        #    e pegar push_tokens
        url = build_tenant_database_url(db_host, db_name)
        engine = create_engine(url, pool_pre_ping=True, future=True)

        all_tokens = []
        with engine.connect() as conn:
            # Verifica se tabelas existem
            tables = [r[0] for r in conn.execute(text(
                "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES "
                "WHERE TABLE_SCHEMA = :db AND TABLE_NAME IN ('users', 'push_tokens')"
            ), {"db": db_name}).fetchall()]

            if "push_tokens" not in tables or "users" not in tables:
                print(f"[push-join] Tabelas users/push_tokens não existem em {db_name}")
                engine.dispose()
                return

            # Buscar user_ids locais dos admins via fk_id_user_hub
            placeholders = ",".join(str(uid) for uid in admin_hub_ids)
            local_admins = conn.execute(text(
                f"SELECT id FROM users WHERE fk_id_user_hub IN ({placeholders})"
            )).fetchall()

            if not local_admins:
                # Fallback: buscar por is_admin = 1
                local_admins = conn.execute(text(
                    "SELECT id FROM users WHERE is_admin = 1"
                )).fetchall()

            local_admin_ids = [r[0] for r in local_admins]
            if not local_admin_ids:
                print(f"[push-join] Nenhum admin local encontrado em {db_name}")
                engine.dispose()
                return

            # Buscar push tokens
            id_list = ",".join(str(uid) for uid in local_admin_ids)
            tokens = conn.execute(text(
                f"SELECT token FROM push_tokens WHERE user_id IN ({id_list})"
            )).fetchall()
            all_tokens = [r[0] for r in tokens if r[0]]

        engine.dispose()

        if not all_tokens:
            print(f"[push-join] Nenhum push token encontrado para admins de {db_name}")
            return

        # 3) Enviar via Expo Push API
        expo_tokens = [t for t in all_tokens if "ExponentPushToken" in t]
        title = "Nova solicitação de acesso"
        body = f"{user_name} quer entrar no {tenant.get('display_name', 'sistema')}. {message}".strip()

        if expo_tokens:
            payload = [
                {
                    "to": token,
                    "title": title,
                    "body": body,
                    "sound": "default",
                    "data": {"type": "join_request", "tenant_id": tenant_id},
                    "channelId": "default",
                    "priority": "high",
                }
                for token in expo_tokens
            ]
            req = Request(
                "https://exp.host/--/api/v2/push/send",
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                method="POST",
            )
            try:
                with urlopen(req, timeout=10) as response:
                    resp_body = json.loads(response.read().decode("utf-8"))
                    print(f"[push-join] Expo OK: {len(expo_tokens)} token(s), resp={resp_body}")
            except Exception as exc:
                print(f"[push-join] Expo ERRO: {exc}")

        # FCM tokens (não-Expo) - skip por agora, Expo API é suficiente
        non_expo = [t for t in all_tokens if "ExponentPushToken" not in t]
        if non_expo:
            print(f"[push-join] {len(non_expo)} token(s) FCM ignorados (sem Firebase Admin no seletor)")

    except Exception as e:
        print(f"[push-join] Erro ao enviar push: {e}")
        if ENV == "dev":
            traceback.print_exc()


# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------
def _tenant_to_dto(row: Dict[str, Any], include_system: bool = True) -> Dict[str, Any]:
    """Converte row para DTO de tenant."""
    dto = {
        "id": row["id"],
        "slug": row["slug"],
        "displayName": row.get("display_name") or row["slug"],
        "logoUrl": row.get("logo_url"),
        "primaryColor": row.get("primary_color") or "#ef4444",
        "welcomeMessage": row.get("welcome_message"),
        "allowRegistration": bool(row.get("allow_registration", True)),
        "memberCount": row.get("member_count", 0),
    }

    if include_system and row.get("system_slug"):
        dto["system"] = {
            "slug": row["system_slug"],
            "displayName": row.get("system_name"),
            "icon": row.get("system_icon"),
            "color": row.get("system_color"),
        }

    return dto


# ------------------------------------------------------------
# Rotas do Usuário (/api/user/*)
# ------------------------------------------------------------
@membership_bp.get("/api/user/tenants")
@login_required
def list_my_tenants():
    """Lista todos os sistemas do usuário logado."""
    try:
        tenants = fetch_all(
            """
            SELECT
                t.id, t.slug, t.display_name, t.logo_url, t.primary_color,
                t.welcome_message,
                s.slug AS system_slug, s.display_name AS system_name,
                s.icon AS system_icon, s.color AS system_color,
                ut.role, ut.joined_at
            FROM user_tenants ut
            INNER JOIN tenants t ON ut.tenant_id = t.id
            INNER JOIN systems s ON t.system_id = s.id
            WHERE ut.user_id = :user_id
              AND ut.is_active = TRUE
              AND t.is_active = TRUE
            ORDER BY s.display_order, t.display_name
            """,
            {"user_id": g.current_user_id},
        )

        # Agrupar por sistema
        by_system = {}
        for t in tenants:
            system_slug = t["system_slug"]
            if system_slug not in by_system:
                by_system[system_slug] = {
                    "slug": system_slug,
                    "displayName": t["system_name"],
                    "icon": t["system_icon"],
                    "color": t["system_color"],
                    "tenants": [],
                }

            by_system[system_slug]["tenants"].append({
                "id": t["id"],
                "slug": t["slug"],
                "displayName": t["display_name"],
                "logoUrl": t.get("logo_url"),
                "primaryColor": t.get("primary_color"),
                "role": t["role"],
                "joinedAt": t["joined_at"].isoformat() if t.get("joined_at") else None,
            })

        return jsonify({
            "systems": list(by_system.values()),
            "total": len(tenants),
        })

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@membership_bp.post("/api/user/tenants/join")
@login_required
def join_tenant():
    """Entrar em um sistema/tenant."""
    try:
        data = request.get_json(silent=True) or {}

        tenant_id = data.get("tenantId")
        tenant_slug = (data.get("tenantSlug") or "").strip()
        message = (data.get("message") or "").strip()

        if not tenant_id and not tenant_slug:
            return jsonify({"error": "tenantId ou tenantSlug é obrigatório"}), 400

        # Buscar tenant
        if tenant_id:
            tenant = fetch_one(
                """
                SELECT t.*, s.slug AS system_slug, s.display_name AS system_name
                FROM tenants t
                INNER JOIN systems s ON t.system_id = s.id
                WHERE t.id = :id AND t.is_active = TRUE
                """,
                {"id": tenant_id},
            )
        else:
            tenant = fetch_one(
                """
                SELECT t.*, s.slug AS system_slug, s.display_name AS system_name
                FROM tenants t
                INNER JOIN systems s ON t.system_id = s.id
                WHERE t.slug = :slug AND t.is_active = TRUE
                """,
                {"slug": tenant_slug},
            )

        if not tenant:
            return jsonify({"error": "Sistema não encontrado"}), 404

        if tenant.get("maintenance_mode"):
            return jsonify({"error": "Sistema em manutenção"}), 503

        # Verificar se já é membro
        existing = fetch_one(
            """
            SELECT id, is_active, left_at FROM user_tenants
            WHERE user_id = :user_id AND tenant_id = :tenant_id
            """,
            {"user_id": g.current_user_id, "tenant_id": tenant["id"]},
        )

        if existing:
            if existing["is_active"]:
                return jsonify({"error": "Você já está inscrito neste sistema"}), 409

            # Reativar membership
            execute_sql(
                """
                UPDATE user_tenants
                SET is_active = TRUE, left_at = NULL, joined_at = NOW()
                WHERE id = :id
                """,
                {"id": existing["id"]},
            )

            return jsonify({
                "message": f"Bem-vindo de volta ao {tenant['display_name']}!",
                "tenant": _tenant_to_dto(tenant),
            })

        system_slug = tenant.get("system_slug", "")

        # Sistemas que auto-aprovam (ex: quadra) - entrada direta como client
        if system_slug in AUTO_APPROVE_SYSTEMS:
            execute_sql(
                """
                INSERT INTO user_tenants (user_id, tenant_id, role)
                VALUES (:user_id, :tenant_id, 'client')
                """,
                {"user_id": g.current_user_id, "tenant_id": tenant["id"]},
            )

            return jsonify({
                "message": f"Você entrou no {tenant['display_name']}!",
                "tenant": _tenant_to_dto(tenant),
            }), 201

        # Verificar se precisa aprovação
        if not tenant.get("allow_registration", True):
            # Criar solicitação
            execute_sql(
                """
                INSERT INTO user_tenant_requests (user_id, tenant_id, message)
                VALUES (:user_id, :tenant_id, :message)
                ON DUPLICATE KEY UPDATE
                    status = 'pending',
                    message = :message,
                    created_at = NOW()
                """,
                {
                    "user_id": g.current_user_id,
                    "tenant_id": tenant["id"],
                    "message": message,
                },
            )

            # Enviar push notification para admins do tenant
            user_row = fetch_one(
                "SELECT name, email FROM users WHERE id = :id",
                {"id": g.current_user_id},
            )
            user_name = user_row["name"] if user_row else "Alguém"
            _notify_tenant_admins_push(tenant, user_name, message)

            return jsonify({
                "message": "Solicitação enviada! Aguarde aprovação do administrador.",
                "status": "pending",
                "tenant": _tenant_to_dto(tenant),
            }), 202

        # Inscrição direta (allow_registration = true)
        execute_sql(
            """
            INSERT INTO user_tenants (user_id, tenant_id, role)
            VALUES (:user_id, :tenant_id, 'player')
            """,
            {"user_id": g.current_user_id, "tenant_id": tenant["id"]},
        )

        return jsonify({
            "message": f"Você entrou no {tenant['display_name']}!",
            "tenant": _tenant_to_dto(tenant),
        }), 201

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@membership_bp.delete("/api/user/tenants/<int:tenant_id>")
@login_required
def leave_tenant(tenant_id: int):
    """Sair de um sistema/tenant."""
    try:
        # Verificar membership
        membership = fetch_one(
            """
            SELECT ut.id, ut.role, t.display_name
            FROM user_tenants ut
            INNER JOIN tenants t ON ut.tenant_id = t.id
            WHERE ut.user_id = :user_id AND ut.tenant_id = :tenant_id AND ut.is_active = TRUE
            """,
            {"user_id": g.current_user_id, "tenant_id": tenant_id},
        )

        if not membership:
            return jsonify({"error": "Você não está inscrito neste sistema"}), 404

        # Não pode sair se for o único admin
        if membership["role"] == "admin":
            admin_count = fetch_one(
                """
                SELECT COUNT(*) AS count FROM user_tenants
                WHERE tenant_id = :tenant_id AND role = 'admin' AND is_active = TRUE
                """,
                {"tenant_id": tenant_id},
            )

            if admin_count and admin_count["count"] <= 1:
                return jsonify({
                    "error": "Você é o único administrador. Promova outro usuário antes de sair."
                }), 400

        # Soft delete
        execute_sql(
            """
            UPDATE user_tenants
            SET is_active = FALSE, left_at = NOW()
            WHERE id = :id
            """,
            {"id": membership["id"]},
        )

        # Se estava com contexto neste tenant, limpar
        execute_sql(
            """
            UPDATE user_sessions
            SET current_tenant_id = NULL
            WHERE user_id = :user_id AND current_tenant_id = :tenant_id
            """,
            {"user_id": g.current_user_id, "tenant_id": tenant_id},
        )

        return jsonify({
            "message": f"Você saiu do {membership['display_name']}",
        })

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


# ------------------------------------------------------------
# Rotas Públicas (/api/tenants/*)
# ------------------------------------------------------------
@membership_bp.get("/api/tenants/available")
def list_available_tenants():
    """Lista sistemas disponíveis para inscrição (público)."""
    try:
        system_slug = request.args.get("system")

        params = {}
        where_clause = "WHERE t.is_active = TRUE AND t.maintenance_mode = FALSE"

        if system_slug:
            where_clause += " AND s.slug = :system_slug"
            params["system_slug"] = system_slug

        tenants = fetch_all(
            f"""
            SELECT
                t.id, t.slug, t.display_name, t.logo_url, t.primary_color,
                t.welcome_message, t.allow_registration,
                s.slug AS system_slug, s.display_name AS system_name,
                s.icon AS system_icon, s.color AS system_color,
                (SELECT COUNT(*) FROM user_tenants ut
                 WHERE ut.tenant_id = t.id AND ut.is_active = TRUE) AS member_count
            FROM tenants t
            INNER JOIN systems s ON t.system_id = s.id
            {where_clause}
            ORDER BY s.display_order, t.display_name
            """,
            params,
        )

        # Agrupar por sistema
        by_system = {}
        for t in tenants:
            system_slug = t["system_slug"]
            if system_slug not in by_system:
                by_system[system_slug] = {
                    "slug": system_slug,
                    "displayName": t["system_name"],
                    "icon": t["system_icon"],
                    "color": t["system_color"],
                    "tenants": [],
                }

            by_system[system_slug]["tenants"].append(_tenant_to_dto(t, include_system=False))

        return jsonify({
            "systems": list(by_system.values()),
            "total": len(tenants),
        })

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@membership_bp.get("/api/tenants/<slug>")
def get_tenant_details(slug: str):
    """Detalhes de um tenant específico (público)."""
    try:
        tenant = fetch_one(
            """
            SELECT
                t.*,
                s.slug AS system_slug, s.display_name AS system_name,
                s.icon AS system_icon, s.color AS system_color,
                (SELECT COUNT(*) FROM user_tenants ut
                 WHERE ut.tenant_id = t.id AND ut.is_active = TRUE) AS member_count
            FROM tenants t
            INNER JOIN systems s ON t.system_id = s.id
            WHERE t.slug = :slug AND t.is_active = TRUE
            """,
            {"slug": slug},
        )

        if not tenant:
            return jsonify({"error": "Sistema não encontrado"}), 404

        dto = _tenant_to_dto(tenant)
        dto["description"] = tenant.get("welcome_message")
        dto["address"] = tenant.get("address")
        dto["city"] = tenant.get("city")
        dto["state"] = tenant.get("state")
        dto["phone"] = tenant.get("phone")
        dto["email"] = tenant.get("email")

        # Buscar features
        features = fetch_all(
            """
            SELECT feature_name, is_enabled, config
            FROM tenant_features
            WHERE tenant_id = :tenant_id
            """,
            {"tenant_id": tenant["id"]},
        )

        dto["features"] = {
            f["feature_name"]: {
                "enabled": bool(f["is_enabled"]),
                "config": f.get("config"),
            }
            for f in features
        }

        return jsonify({"tenant": dto})

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


# ------------------------------------------------------------
# Rotas de Admin (/api/tenants/:id/members/*)
# ------------------------------------------------------------
@membership_bp.get("/api/tenants/<int:tenant_id>/members")
@login_required
def list_tenant_members(tenant_id: int):
    """Lista membros de um tenant (requer ser admin/manager do tenant)."""
    try:
        # Verificar permissão
        membership = fetch_one(
            """
            SELECT role FROM user_tenants
            WHERE user_id = :user_id AND tenant_id = :tenant_id AND is_active = TRUE
            """,
            {"user_id": g.current_user_id, "tenant_id": tenant_id},
        )

        if not membership or membership["role"] not in ("admin", "manager"):
            return jsonify({"error": "Sem permissão para ver membros"}), 403

        members = fetch_all(
            """
            SELECT
                u.id, u.name, u.nickname, u.email, u.avatar_url,
                ut.role, ut.joined_at
            FROM user_tenants ut
            INNER JOIN users u ON ut.user_id = u.id
            WHERE ut.tenant_id = :tenant_id AND ut.is_active = TRUE
            ORDER BY ut.role DESC, u.name
            """,
            {"tenant_id": tenant_id},
        )

        return jsonify({
            "members": [
                {
                    "id": m["id"],
                    "name": m["name"],
                    "nickname": m.get("nickname"),
                    "email": m["email"],
                    "avatarUrl": m.get("avatar_url"),
                    "role": m["role"],
                    "joinedAt": m["joined_at"].isoformat() if m.get("joined_at") else None,
                }
                for m in members
            ],
            "total": len(members),
        })

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@membership_bp.get("/api/tenants/<int:tenant_id>/requests")
@login_required
def list_tenant_requests(tenant_id: int):
    """Lista solicitações pendentes (requer ser admin/manager)."""
    try:
        # Verificar permissão
        membership = fetch_one(
            """
            SELECT role FROM user_tenants
            WHERE user_id = :user_id AND tenant_id = :tenant_id AND is_active = TRUE
            """,
            {"user_id": g.current_user_id, "tenant_id": tenant_id},
        )

        if not membership or membership["role"] not in ("admin", "manager"):
            return jsonify({"error": "Sem permissão"}), 403

        requests = fetch_all(
            """
            SELECT
                r.id, r.message, r.status, r.created_at,
                u.id AS user_id, u.name, u.nickname, u.email, u.avatar_url
            FROM user_tenant_requests r
            INNER JOIN users u ON r.user_id = u.id
            WHERE r.tenant_id = :tenant_id AND r.status = 'pending'
            ORDER BY r.created_at ASC
            """,
            {"tenant_id": tenant_id},
        )

        return jsonify({
            "requests": [
                {
                    "id": r["id"],
                    "message": r.get("message"),
                    "createdAt": r["created_at"].isoformat() if r.get("created_at") else None,
                    "user": {
                        "id": r["user_id"],
                        "name": r["name"],
                        "nickname": r.get("nickname"),
                        "email": r["email"],
                        "avatarUrl": r.get("avatar_url"),
                    },
                }
                for r in requests
            ],
            "total": len(requests),
        })

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@membership_bp.post("/api/tenants/<int:tenant_id>/requests/<int:request_id>/approve")
@login_required
def approve_request(tenant_id: int, request_id: int):
    """Aprovar solicitação de entrada."""
    try:
        # Verificar permissão
        membership = fetch_one(
            """
            SELECT role FROM user_tenants
            WHERE user_id = :user_id AND tenant_id = :tenant_id AND is_active = TRUE
            """,
            {"user_id": g.current_user_id, "tenant_id": tenant_id},
        )

        if not membership or membership["role"] not in ("admin", "manager"):
            return jsonify({"error": "Sem permissão"}), 403

        # Buscar solicitação
        req = fetch_one(
            """
            SELECT r.*, u.name AS user_name
            FROM user_tenant_requests r
            INNER JOIN users u ON r.user_id = u.id
            WHERE r.id = :id AND r.tenant_id = :tenant_id AND r.status = 'pending'
            """,
            {"id": request_id, "tenant_id": tenant_id},
        )

        if not req:
            return jsonify({"error": "Solicitação não encontrada"}), 404

        # Aprovar
        execute_sql(
            """
            UPDATE user_tenant_requests
            SET status = 'approved', responded_by = :admin_id, responded_at = NOW()
            WHERE id = :id
            """,
            {"id": request_id, "admin_id": g.current_user_id},
        )

        # Criar membership
        execute_sql(
            """
            INSERT INTO user_tenants (user_id, tenant_id, role, approved_by, approved_at)
            VALUES (:user_id, :tenant_id, 'player', :admin_id, NOW())
            ON DUPLICATE KEY UPDATE
                is_active = TRUE, left_at = NULL, approved_by = :admin_id, approved_at = NOW()
            """,
            {
                "user_id": req["user_id"],
                "tenant_id": tenant_id,
                "admin_id": g.current_user_id,
            },
        )

        return jsonify({
            "message": f"{req['user_name']} foi aprovado!",
        })

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@membership_bp.post("/api/tenants/<int:tenant_id>/requests/<int:request_id>/reject")
@login_required
def reject_request(tenant_id: int, request_id: int):
    """Rejeitar solicitação de entrada."""
    try:
        data = request.get_json(silent=True) or {}
        reason = (data.get("reason") or "").strip()

        # Verificar permissão
        membership = fetch_one(
            """
            SELECT role FROM user_tenants
            WHERE user_id = :user_id AND tenant_id = :tenant_id AND is_active = TRUE
            """,
            {"user_id": g.current_user_id, "tenant_id": tenant_id},
        )

        if not membership or membership["role"] not in ("admin", "manager"):
            return jsonify({"error": "Sem permissão"}), 403

        # Rejeitar
        execute_sql(
            """
            UPDATE user_tenant_requests
            SET status = 'rejected',
                response_message = :reason,
                responded_by = :admin_id,
                responded_at = NOW()
            WHERE id = :id AND tenant_id = :tenant_id AND status = 'pending'
            """,
            {
                "id": request_id,
                "tenant_id": tenant_id,
                "reason": reason,
                "admin_id": g.current_user_id,
            },
        )

        return jsonify({"message": "Solicitação rejeitada"})

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500
