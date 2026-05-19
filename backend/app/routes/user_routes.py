"""
Rotas inter-service para consulta de perfil de usuário.

Permite que tenants (varzea-prime, lance-de-ouro) busquem dados
do perfil centralizado no hub via SERVICE_API_KEY.

Endpoints:
- GET  /api/users/<id>/profile         - Perfil completo do usuário (inter-service)
- GET  /api/users/by-tenant/<slug>     - Usuarios de um tenant (inter-service)
- GET  /api/users/search               - Buscar usuarios por nome/email/cpf (inter-service)
- POST /api/users/tenants/<slug>/link/<user_id> - Linkar user a tenant (inter-service)
- DELETE /api/users/tenants/<slug>/unlink/<user_id> - Remover user de tenant (inter-service)
- GET  /api/users/tenants/<slug>/requests        - Pedidos pendentes (inter-service)
- POST /api/users/tenants/<slug>/requests/<id>/approve - Aprovar pedido (inter-service)
- POST /api/users/tenants/<slug>/requests/<id>/reject  - Rejeitar pedido (inter-service)
"""
from __future__ import annotations

import os
import traceback
from functools import wraps
from typing import Any, Dict

from flask import Blueprint, jsonify, request
from sqlalchemy import create_engine, text

from app.db import (
    execute_sql,
    fetch_all,
    fetch_one,
    safe_db_error,
    build_tenant_database_url,
    TENANT_DB_HOST,
)

user_bp = Blueprint("users", __name__, url_prefix="/api/users")

ENV = os.getenv("ENV", "dev")
SERVICE_API_KEY = os.getenv("SERVICE_API_KEY", "")


def _service_auth_required(f):
    """Decorator que exige X-Service-Key válida."""
    @wraps(f)
    def decorated(*args, **kwargs):
        key = request.headers.get("X-Service-Key", "")
        if not SERVICE_API_KEY or key != SERVICE_API_KEY:
            return jsonify({"error": "Acesso negado"}), 403
        return f(*args, **kwargs)
    return decorated


def _user_profile_dto(row: Dict[str, Any]) -> Dict[str, Any]:
    """Converte row do banco para DTO de perfil inter-service."""
    return {
        "id": row["id"],
        "name": row["name"],
        "nickname": row.get("nickname"),
        "email": row["email"],
        "phone": row.get("phone"),
        "cpf": row.get("cpf"),
        "cnpj": row.get("cnpj"),
        "avatarUrl": row.get("avatar_url"),
        "bio": row.get("bio"),
        "cep": row.get("cep"),
        "logradouro": row.get("logradouro"),
        "numero": row.get("numero"),
        "bairro": row.get("bairro"),
        "complemento": row.get("complemento"),
        "city": row.get("city"),
        "state": row.get("state"),
        "timezone": row.get("timezone"),
        "isActive": bool(row.get("is_active", True)),
        "createdAt": row.get("created_at").isoformat() if row.get("created_at") else None,
    }


@user_bp.get("/by-tenant/<string:tenant_slug>/<int:tenant_user_id>/profile")
@_service_auth_required
def get_user_profile_by_tenant(tenant_slug: str, tenant_user_id: int):
    """Resolve profile (name, nickname) a partir do ID local do tenant.

    Útil quando o cliente (ex.: lance-de-ouro) só conhece o id do user
    dentro do banco do tenant e precisa do nickname/nome canônicos.
    Lê direto a tabela `users` do tenant — não exige sincronização
    perfeita com o hub.
    """
    try:
        tenant = fetch_one(
            "SELECT id, database_host, database_name FROM tenants "
            "WHERE slug = :slug AND is_active = TRUE",
            {"slug": tenant_slug},
        )
        if not tenant:
            return jsonify({"error": "Tenant não encontrado"}), 404

        db_name = tenant.get("database_name")
        db_host = tenant.get("database_host") or TENANT_DB_HOST
        if not db_name:
            return jsonify({"error": "Tenant sem database_name"}), 500

        url = build_tenant_database_url(db_host, db_name)
        engine = create_engine(url, pool_pre_ping=True, future=True)
        try:
            with engine.connect() as conn:
                row = conn.execute(
                    text(
                        "SELECT id, name, nickname, fk_id_user_hub "
                        "FROM users WHERE id = :id"
                    ),
                    {"id": tenant_user_id},
                ).mappings().first()
        finally:
            engine.dispose()

        if not row:
            return jsonify({"error": "Usuário não encontrado no tenant"}), 404

        return jsonify({
            "tenant_user_id": row["id"],
            "hub_user_id": row.get("fk_id_user_hub"),
            "name": row.get("name"),
            "nickname": row.get("nickname"),
        })

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@user_bp.get("/<int:user_id>/profile")
@_service_auth_required
def get_user_profile(user_id: int):
    """Retorna perfil completo de um usuário (para uso inter-service)."""
    try:
        user = fetch_one(
            "SELECT * FROM users WHERE id = :id",
            {"id": user_id},
        )
        if not user:
            return jsonify({"error": "Usuário não encontrado"}), 404

        # Buscar interesses
        interests = fetch_all(
            """
            SELECT s.id, s.slug, s.display_name
            FROM user_interests ui
            INNER JOIN systems s ON s.id = ui.system_id
            WHERE ui.user_id = :user_id
            ORDER BY s.display_order, s.id
            """,
            {"user_id": user_id},
        )

        dto = _user_profile_dto(user)
        dto["interests"] = [
            {"id": i["id"], "slug": i["slug"], "displayName": i["display_name"]}
            for i in interests
        ]

        return jsonify(dto)

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@user_bp.get("/by-tenant/<slug>")
@_service_auth_required
def get_users_by_tenant(slug: str):
    """Retorna usuarios vinculados a um tenant (inter-service).

    Usado pelo SGQ e outros sistemas para listar membros/clientes.
    """
    try:
        tenant = fetch_one(
            "SELECT id FROM tenants WHERE slug = :slug AND is_active = TRUE",
            {"slug": slug},
        )
        if not tenant:
            return jsonify({"error": "Tenant não encontrado"}), 404

        rows = fetch_all(
            """
            SELECT u.*, ut.role, ut.joined_at
            FROM user_tenants ut
            INNER JOIN users u ON ut.user_id = u.id
            WHERE ut.tenant_id = :tid AND ut.is_active = TRUE
            ORDER BY u.name
            """,
            {"tid": tenant["id"]},
        )

        users = []
        for r in rows:
            dto = _user_profile_dto(r)
            dto["role"] = r.get("role", "player")
            dto["joinedAt"] = r["joined_at"].isoformat() if r.get("joined_at") else None
            users.append(dto)

        return jsonify({"users": users, "total": len(users)})

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@user_bp.get("/all-active")
@_service_auth_required
def get_all_active_users():
    """Retorna TODOS os usuarios ativos do hub (inter-service).

    Usado por sistemas do tipo 'quadra' onde todos os usuarios sao
    clientes automaticamente (sem necessidade de vinculo via user_tenants).

    Query params:
    - limit: max results (default 500, max 2000)
    - offset: pagination offset (default 0)
    """
    try:
        limit = min(2000, max(1, int(request.args.get("limit", 500))))
        offset = max(0, int(request.args.get("offset", 0)))

        rows = fetch_all(
            """
            SELECT * FROM users
            WHERE is_active = TRUE
            ORDER BY name
            LIMIT :lim OFFSET :off
            """,
            {"lim": limit, "off": offset},
        )

        total_row = fetch_one("SELECT COUNT(*) AS cnt FROM users WHERE is_active = TRUE")
        total = total_row["cnt"] if total_row else len(rows)

        users = []
        for r in rows:
            dto = _user_profile_dto(r)
            dto["role"] = "client"
            users.append(dto)

        return jsonify({"users": users, "total": total})

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@user_bp.get("/search")
@_service_auth_required
def search_users():
    """Busca usuarios por nome, email, cpf, nickname, phone (inter-service).

    Query params:
    - q: termo de busca (obrigatório, min 2 chars)
    - limit: máximo de resultados (default 20, max 100)
    """
    try:
        q = (request.args.get("q") or "").strip().lower()
        if len(q) < 2:
            return jsonify({"error": "Busca precisa de pelo menos 2 caracteres"}), 400

        limit = min(100, max(1, int(request.args.get("limit", 20))))

        rows = fetch_all(
            """
            SELECT * FROM users
            WHERE is_active = TRUE
              AND (LOWER(name) LIKE :q
                   OR LOWER(email) LIKE :q
                   OR LOWER(COALESCE(phone,'')) LIKE :q
                   OR LOWER(COALESCE(cpf,'')) LIKE :q
                   OR LOWER(COALESCE(nickname,'')) LIKE :q)
            ORDER BY name
            LIMIT :lim
            """,
            {"q": f"%{q}%", "lim": limit},
        )

        return jsonify({
            "users": [_user_profile_dto(r) for r in rows],
            "total": len(rows),
        })

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@user_bp.post("/tenants/<slug>/link/<int:user_id>")
@_service_auth_required
def link_user_to_tenant(slug: str, user_id: int):
    """Linka user a um tenant (inter-service). Idempotente.

    Body (opcional): { "role": "client" }
    """
    try:
        tenant = fetch_one(
            "SELECT id, display_name FROM tenants WHERE slug = :slug AND is_active = TRUE",
            {"slug": slug},
        )
        if not tenant:
            return jsonify({"error": "Tenant não encontrado"}), 404

        user = fetch_one("SELECT id FROM users WHERE id = :id", {"id": user_id})
        if not user:
            return jsonify({"error": "Usuário não encontrado"}), 404

        data = request.get_json(silent=True) or {}
        role = data.get("role", "client")
        valid_roles = ("player", "admin", "manager", "viewer", "client")
        if role not in valid_roles:
            role = "client"

        execute_sql(
            """
            INSERT INTO user_tenants (user_id, tenant_id, role)
            VALUES (:user_id, :tenant_id, :role)
            ON DUPLICATE KEY UPDATE is_active = TRUE, left_at = NULL, role = :role
            """,
            {"user_id": user_id, "tenant_id": tenant["id"], "role": role},
        )

        return jsonify({
            "message": f"Usuário linkado ao {tenant['display_name']}",
            "tenantId": tenant["id"],
            "userId": user_id,
            "role": role,
        }), 201

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@user_bp.delete("/tenants/<slug>/unlink/<int:user_id>")
@_service_auth_required
def unlink_user_from_tenant(slug: str, user_id: int):
    """Remove user de um tenant (inter-service)."""
    try:
        tenant = fetch_one(
            "SELECT id FROM tenants WHERE slug = :slug",
            {"slug": slug},
        )
        if not tenant:
            return jsonify({"error": "Tenant não encontrado"}), 404

        execute_sql(
            """
            UPDATE user_tenants
            SET is_active = FALSE, left_at = NOW()
            WHERE user_id = :user_id AND tenant_id = :tenant_id
            """,
            {"user_id": user_id, "tenant_id": tenant["id"]},
        )

        return jsonify({"message": "Usuário removido do tenant"})

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


# ── Access requests (inter-service) ──────────────────────────────

@user_bp.get("/tenants/<slug>/requests")
@_service_auth_required
def list_tenant_requests(slug: str):
    """Lista pedidos pendentes de acesso a um tenant (inter-service)."""
    try:
        tenant = fetch_one(
            "SELECT id FROM tenants WHERE slug = :slug AND is_active = TRUE",
            {"slug": slug},
        )
        if not tenant:
            return jsonify({"error": "Tenant não encontrado"}), 404

        rows = fetch_all(
            """
            SELECT
                r.id, r.message, r.status, r.created_at,
                u.id AS user_id, u.name, u.nickname, u.email,
                u.phone, u.avatar_url
            FROM user_tenant_requests r
            INNER JOIN users u ON r.user_id = u.id
            WHERE r.tenant_id = :tid AND r.status = 'pending'
            ORDER BY r.created_at ASC
            """,
            {"tid": tenant["id"]},
        )

        requests_list = [
            {
                "id": r["id"],
                "message": r.get("message"),
                "createdAt": r["created_at"].isoformat() if r.get("created_at") else None,
                "user": {
                    "id": r["user_id"],
                    "name": r.get("name", ""),
                    "nickname": r.get("nickname"),
                    "email": r.get("email", ""),
                    "phone": r.get("phone"),
                    "avatarUrl": r.get("avatar_url"),
                },
            }
            for r in rows
        ]

        return jsonify({"requests": requests_list, "total": len(requests_list)})

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@user_bp.post("/tenants/<slug>/requests/<int:request_id>/approve")
@_service_auth_required
def approve_tenant_request(slug: str, request_id: int):
    """Aprova um pedido de acesso (inter-service)."""
    try:
        tenant = fetch_one(
            "SELECT id FROM tenants WHERE slug = :slug AND is_active = TRUE",
            {"slug": slug},
        )
        if not tenant:
            return jsonify({"error": "Tenant não encontrado"}), 404

        req_row = fetch_one(
            """
            SELECT r.id, r.user_id, r.status, u.name
            FROM user_tenant_requests r
            INNER JOIN users u ON r.user_id = u.id
            WHERE r.id = :id AND r.tenant_id = :tid
            """,
            {"id": request_id, "tid": tenant["id"]},
        )
        if not req_row:
            return jsonify({"error": "Solicitação não encontrada"}), 404
        if req_row["status"] != "pending":
            return jsonify({"error": "Solicitação já foi processada"}), 409

        execute_sql(
            """
            UPDATE user_tenant_requests
            SET status = 'approved', responded_at = NOW()
            WHERE id = :id
            """,
            {"id": request_id},
        )

        execute_sql(
            """
            INSERT INTO user_tenants (user_id, tenant_id, role, approved_at)
            VALUES (:user_id, :tenant_id, 'player', NOW())
            ON DUPLICATE KEY UPDATE
                is_active = TRUE, left_at = NULL, approved_at = NOW()
            """,
            {"user_id": req_row["user_id"], "tenant_id": tenant["id"]},
        )

        return jsonify({
            "message": f"{req_row['name']} foi aprovado!",
            "userId": req_row["user_id"],
        })

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@user_bp.post("/tenants/<slug>/requests/<int:request_id>/reject")
@_service_auth_required
def reject_tenant_request(slug: str, request_id: int):
    """Rejeita um pedido de acesso (inter-service)."""
    try:
        tenant = fetch_one(
            "SELECT id FROM tenants WHERE slug = :slug AND is_active = TRUE",
            {"slug": slug},
        )
        if not tenant:
            return jsonify({"error": "Tenant não encontrado"}), 404

        req_row = fetch_one(
            "SELECT id, status FROM user_tenant_requests WHERE id = :id AND tenant_id = :tid",
            {"id": request_id, "tid": tenant["id"]},
        )
        if not req_row:
            return jsonify({"error": "Solicitação não encontrada"}), 404
        if req_row["status"] != "pending":
            return jsonify({"error": "Solicitação já foi processada"}), 409

        data = request.get_json(silent=True) or {}
        reason = data.get("reason", "")

        execute_sql(
            """
            UPDATE user_tenant_requests
            SET status = 'rejected', response_message = :reason, responded_at = NOW()
            WHERE id = :id
            """,
            {"id": request_id, "reason": reason},
        )

        return jsonify({"message": "Solicitação rejeitada"})

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500
