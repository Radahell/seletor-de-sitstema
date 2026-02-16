"""
Rotas de autenticação centralizada.

Endpoints:
- POST /api/auth/register - Criar conta
- POST /api/auth/login - Login
- POST /api/auth/logout - Logout
- GET  /api/auth/me - Dados do usuário logado
- PUT  /api/auth/me - Atualizar perfil
- POST /api/auth/change-password - Trocar senha
"""
from __future__ import annotations

import datetime
import hashlib
import os
import re
import traceback
from functools import wraps
from typing import Any, Dict, Optional

import jwt
from flask import Blueprint, current_app, g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from app.db import execute_sql, fetch_all, fetch_one, safe_db_error

_SHA256_RE = re.compile(r"^[a-f0-9]{64}$")


def _verify_stored_password(stored_hash: str, password: str) -> bool:
    """Verifica senha contra hash armazenado (suporta werkzeug e SHA256 legado)."""
    if _SHA256_RE.match(stored_hash):
        return hashlib.sha256(password.encode("utf-8")).hexdigest() == stored_hash
    return check_password_hash(stored_hash, password)


def _upgrade_password_hash(user_id: int, password: str) -> None:
    """Atualiza hash SHA256 legado para werkzeug scrypt."""
    new_hash = generate_password_hash(password)
    execute_sql(
        "UPDATE users SET password_hash = :hash WHERE id = :id",
        {"hash": new_hash, "id": user_id},
    )

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

ENV = os.getenv("ENV", "dev")
JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "24"))


# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------
def _hash_token(token: str) -> str:
    """Cria hash SHA256 do token para armazenar no banco."""
    return hashlib.sha256(token.encode()).hexdigest()


def _create_token(user_id: int, email: str, expires_hours: int = None) -> str:
    """Gera JWT token."""
    if expires_hours is None:
        expires_hours = JWT_EXPIRY_HOURS

    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=expires_hours),
        "iat": datetime.datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def _get_client_info() -> Dict[str, Any]:
    """Extrai informações do cliente da requisição."""
    user_agent = request.headers.get("User-Agent", "")
    device_type = "unknown"

    ua_lower = user_agent.lower()
    if "mobile" in ua_lower or "android" in ua_lower or "iphone" in ua_lower:
        device_type = "mobile"
    elif "tablet" in ua_lower or "ipad" in ua_lower:
        device_type = "tablet"
    elif user_agent:
        device_type = "web"

    return {
        "ip_address": request.remote_addr,
        "user_agent": user_agent[:500] if user_agent else None,
        "device_type": device_type,
        "device_name": request.headers.get("X-Device-Name"),
    }


def _create_session(user_id: int, token: str, tenant_id: int = None) -> None:
    """Cria registro de sessão no banco."""
    client = _get_client_info()
    token_hash = _hash_token(token)
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(hours=JWT_EXPIRY_HOURS)

    execute_sql(
        """
        INSERT INTO user_sessions (
            user_id, token_hash, device_name, device_type,
            ip_address, user_agent, current_tenant_id, expires_at
        ) VALUES (
            :user_id, :token_hash, :device_name, :device_type,
            :ip_address, :user_agent, :tenant_id, :expires_at
        )
        """,
        {
            "user_id": user_id,
            "token_hash": token_hash,
            "device_name": client["device_name"],
            "device_type": client["device_type"],
            "ip_address": client["ip_address"],
            "user_agent": client["user_agent"],
            "tenant_id": tenant_id,
            "expires_at": expires_at,
        },
    )


def _revoke_session(token_hash: str, reason: str = None) -> None:
    """Revoga uma sessão."""
    execute_sql(
        """
        UPDATE user_sessions
        SET revoked_at = NOW(), revoked_reason = :reason
        WHERE token_hash = :token_hash AND revoked_at IS NULL
        """,
        {"token_hash": token_hash, "reason": reason},
    )


def _user_to_dto(row: Dict[str, Any]) -> Dict[str, Any]:
    """Converte row do banco para DTO."""
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
        "lastLoginAt": row.get("last_login_at").isoformat() if row.get("last_login_at") else None,
    }


# ------------------------------------------------------------
# Decorators
# ------------------------------------------------------------
def login_required(f):
    """Decorator que exige autenticação."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]

        if not token:
            return jsonify({"error": "Token de autenticação ausente"}), 401

        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expirado. Faça login novamente."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Token inválido"}), 401

        # Verificar se sessão ainda é válida
        token_hash = _hash_token(token)
        session = fetch_one(
            """
            SELECT id, user_id, current_tenant_id
            FROM user_sessions
            WHERE token_hash = :token_hash
              AND revoked_at IS NULL
              AND expires_at > NOW()
            """,
            {"token_hash": token_hash},
        )

        if not session:
            return jsonify({"error": "Sessão inválida ou expirada"}), 401

        # Buscar usuário
        user = fetch_one(
            "SELECT * FROM users WHERE id = :id AND is_active = TRUE",
            {"id": payload["user_id"]},
        )

        if not user:
            return jsonify({"error": "Usuário não encontrado ou inativo"}), 401

        if user.get("is_blocked"):
            return jsonify({"error": "Conta bloqueada", "reason": user.get("blocked_reason")}), 403

        # Atualizar última atividade
        execute_sql(
            "UPDATE user_sessions SET last_activity_at = NOW() WHERE id = :id",
            {"id": session["id"]},
        )

        # Disponibilizar no contexto
        g.current_user = user
        g.current_user_id = user["id"]
        g.current_session_id = session["id"]
        g.current_tenant_id = session.get("current_tenant_id")
        g.token_hash = token_hash

        return f(*args, **kwargs)

    return decorated


# ------------------------------------------------------------
# Rotas Públicas
# ------------------------------------------------------------
@auth_bp.post("/register")
def register():
    """Criar nova conta."""
    try:
        data = request.get_json(silent=True) or {}

        name = (data.get("name") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        nickname = (data.get("nickname") or "").strip() or None
        phone = (data.get("phone") or "").strip() or None
        cpf = (data.get("cpf") or "").strip() or None
        cnpj = (data.get("cnpj") or "").strip() or None
        cep = (data.get("cep") or "").strip() or None
        logradouro = (data.get("logradouro") or "").strip() or None
        numero = (data.get("numero") or "").strip() or None
        bairro = (data.get("bairro") or "").strip() or None
        complemento = (data.get("complemento") or "").strip() or None
        city = (data.get("city") or "").strip() or None
        state = (data.get("state") or "").strip().upper()[:2] or None
        tz = (data.get("timezone") or "").strip() or None
        interests = data.get("interests") or []

        # Validações
        if not name:
            return jsonify({"error": "Nome é obrigatório"}), 400
        if not email:
            return jsonify({"error": "Email é obrigatório"}), 400
        if not password:
            return jsonify({"error": "Senha é obrigatória"}), 400
        if len(password) < 6:
            return jsonify({"error": "Senha deve ter no mínimo 6 caracteres"}), 400

        # Verificar email único
        existing = fetch_one("SELECT id FROM users WHERE email = :email", {"email": email})
        if existing:
            return jsonify({"error": "Este email já está cadastrado"}), 409

        # Criar usuário
        password_hash = generate_password_hash(password)

        execute_sql(
            """
            INSERT INTO users (
                name, nickname, email, phone, cpf, cnpj,
                cep, logradouro, numero, bairro, complemento,
                city, state, timezone, password_hash
            ) VALUES (
                :name, :nickname, :email, :phone, :cpf, :cnpj,
                :cep, :logradouro, :numero, :bairro, :complemento,
                :city, :state, :timezone, :password_hash
            )
            """,
            {
                "name": name,
                "nickname": nickname,
                "email": email,
                "phone": phone,
                "cpf": cpf,
                "cnpj": cnpj,
                "cep": cep,
                "logradouro": logradouro,
                "numero": numero,
                "bairro": bairro,
                "complemento": complemento,
                "city": city,
                "state": state,
                "timezone": tz,
                "password_hash": password_hash,
            },
        )

        # Buscar usuário criado
        user = fetch_one("SELECT * FROM users WHERE email = :email", {"email": email})

        # Salvar interesses (lead capture)
        if interests:
            for sys_id in interests:
                try:
                    execute_sql(
                        """
                        INSERT INTO user_interests (user_id, system_id)
                        VALUES (:user_id, :system_id)
                        ON DUPLICATE KEY UPDATE created_at = created_at
                        """,
                        {"user_id": user["id"], "system_id": int(sys_id)},
                    )
                except Exception:
                    pass  # ignora system_id inválido

        # Gerar token
        token = _create_token(user["id"], email)

        # Criar sessão
        _create_session(user["id"], token)

        return jsonify({
            "message": "Conta criada com sucesso!",
            "token": token,
            "user": _user_to_dto(user),
        }), 201

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@auth_bp.post("/login")
def login():
    """Fazer login."""
    try:
        data = request.get_json(silent=True) or {}

        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        if not email or not password:
            return jsonify({"error": "Email e senha são obrigatórios"}), 400

        # Buscar usuário
        user = fetch_one("SELECT * FROM users WHERE email = :email", {"email": email})

        if not user:
            return jsonify({"error": "Credenciais inválidas"}), 401

        if not _verify_stored_password(user["password_hash"], password):
            return jsonify({"error": "Credenciais inválidas"}), 401

        # Auto-upgrade: SHA256 legado → werkzeug scrypt
        if _SHA256_RE.match(user["password_hash"]):
            _upgrade_password_hash(user["id"], password)

        if not user.get("is_active", True):
            return jsonify({"error": "Conta desativada"}), 403

        if user.get("is_blocked"):
            return jsonify({
                "error": "Conta bloqueada",
                "reason": user.get("blocked_reason"),
            }), 403

        # Atualizar último login
        execute_sql(
            "UPDATE users SET last_login_at = NOW() WHERE id = :id",
            {"id": user["id"]},
        )

        # Gerar token
        token = _create_token(user["id"], email)

        # Criar sessão
        _create_session(user["id"], token)

        # Buscar tenants do usuário
        tenants = fetch_all(
            """
            SELECT
                t.id, t.slug, t.display_name, t.logo_url, t.primary_color,
                s.slug AS system_slug, s.display_name AS system_name,
                s.icon AS system_icon, s.color AS system_color,
                ut.role
            FROM user_tenants ut
            INNER JOIN tenants t ON ut.tenant_id = t.id
            INNER JOIN systems s ON t.system_id = s.id
            WHERE ut.user_id = :user_id
              AND ut.is_active = TRUE
              AND t.is_active = TRUE
            ORDER BY s.display_order, t.display_name
            """,
            {"user_id": user["id"]},
        )

        # Verificar se é super admin
        sa_row = fetch_one(
            "SELECT 1 FROM super_admins WHERE email = :email AND is_active = TRUE",
            {"email": email},
        )
        is_super_admin = bool(sa_row)

        return jsonify({
            "message": "Login realizado com sucesso!",
            "token": token,
            "user": _user_to_dto(user),
            "isSuperAdmin": is_super_admin,
            "tenants": [
                {
                    "id": t["id"],
                    "slug": t["slug"],
                    "displayName": t["display_name"],
                    "logoUrl": t.get("logo_url"),
                    "primaryColor": t.get("primary_color"),
                    "role": t["role"],
                    "system": {
                        "slug": t["system_slug"],
                        "displayName": t["system_name"],
                        "icon": t["system_icon"],
                        "color": t["system_color"],
                    },
                }
                for t in tenants
            ],
        })

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


# ------------------------------------------------------------
# Rotas Autenticadas
# ------------------------------------------------------------
@auth_bp.post("/logout")
@login_required
def logout():
    """Fazer logout (revogar sessão atual)."""
    try:
        _revoke_session(g.token_hash, "user_logout")
        return jsonify({"message": "Logout realizado com sucesso"})
    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@auth_bp.post("/logout-all")
@login_required
def logout_all():
    """Fazer logout de todas as sessões."""
    try:
        execute_sql(
            """
            UPDATE user_sessions
            SET revoked_at = NOW(), revoked_reason = 'logout_all'
            WHERE user_id = :user_id AND revoked_at IS NULL
            """,
            {"user_id": g.current_user_id},
        )
        return jsonify({"message": "Todas as sessões foram encerradas"})
    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@auth_bp.get("/me")
@login_required
def get_me():
    """Retorna dados do usuário logado."""
    try:
        # Buscar tenants
        tenants = fetch_all(
            """
            SELECT
                t.id, t.slug, t.display_name, t.logo_url, t.primary_color,
                s.slug AS system_slug, s.display_name AS system_name,
                s.icon AS system_icon, s.color AS system_color,
                ut.role
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

        # Verificar se é super admin
        sa_row = fetch_one(
            "SELECT 1 FROM super_admins WHERE email = :email AND is_active = TRUE",
            {"email": g.current_user["email"]},
        )
        is_super_admin = bool(sa_row)

        return jsonify({
            "user": _user_to_dto(g.current_user),
            "isSuperAdmin": is_super_admin,
            "currentTenantId": g.current_tenant_id,
            "tenants": [
                {
                    "id": t["id"],
                    "slug": t["slug"],
                    "displayName": t["display_name"],
                    "logoUrl": t.get("logo_url"),
                    "primaryColor": t.get("primary_color"),
                    "role": t["role"],
                    "system": {
                        "slug": t["system_slug"],
                        "displayName": t["system_name"],
                        "icon": t["system_icon"],
                        "color": t["system_color"],
                    },
                }
                for t in tenants
            ],
        })

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@auth_bp.put("/me")
@login_required
def update_me():
    """Atualizar perfil do usuário."""
    try:
        data = request.get_json(silent=True) or {}

        updates = []
        params = {"id": g.current_user_id}

        if "name" in data:
            name = (data["name"] or "").strip()
            if not name:
                return jsonify({"error": "Nome não pode ser vazio"}), 400
            updates.append("name = :name")
            params["name"] = name

        if "nickname" in data:
            updates.append("nickname = :nickname")
            params["nickname"] = (data["nickname"] or "").strip() or None

        if "phone" in data:
            updates.append("phone = :phone")
            params["phone"] = (data["phone"] or "").strip() or None

        if "bio" in data:
            updates.append("bio = :bio")
            params["bio"] = (data["bio"] or "").strip() or None

        if "cpf" in data:
            updates.append("cpf = :cpf")
            params["cpf"] = (data["cpf"] or "").strip() or None

        if "cnpj" in data:
            updates.append("cnpj = :cnpj")
            params["cnpj"] = (data["cnpj"] or "").strip() or None

        if "cep" in data:
            updates.append("cep = :cep")
            params["cep"] = (data["cep"] or "").strip() or None

        if "logradouro" in data:
            updates.append("logradouro = :logradouro")
            params["logradouro"] = (data["logradouro"] or "").strip() or None

        if "numero" in data:
            updates.append("numero = :numero")
            params["numero"] = (data["numero"] or "").strip() or None

        if "bairro" in data:
            updates.append("bairro = :bairro")
            params["bairro"] = (data["bairro"] or "").strip() or None

        if "complemento" in data:
            updates.append("complemento = :complemento")
            params["complemento"] = (data["complemento"] or "").strip() or None

        if "city" in data:
            updates.append("city = :city")
            params["city"] = (data["city"] or "").strip() or None

        if "state" in data:
            updates.append("state = :state")
            val = (data["state"] or "").strip().upper()
            params["state"] = val[:2] if val else None

        if "timezone" in data:
            updates.append("timezone = :timezone")
            params["timezone"] = (data["timezone"] or "").strip() or None

        if "avatarUrl" in data:
            updates.append("avatar_url = :avatar_url")
            params["avatar_url"] = (data["avatarUrl"] or "").strip() or None

        if not updates:
            return jsonify({"error": "Nenhum campo para atualizar"}), 400

        execute_sql(
            f"UPDATE users SET {', '.join(updates)} WHERE id = :id",
            params,
        )

        # Retornar usuário atualizado
        user = fetch_one("SELECT * FROM users WHERE id = :id", {"id": g.current_user_id})

        return jsonify({
            "message": "Perfil atualizado com sucesso",
            "user": _user_to_dto(user),
        })

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@auth_bp.post("/change-password")
@login_required
def change_password():
    """Trocar senha."""
    try:
        data = request.get_json(silent=True) or {}

        current_password = data.get("currentPassword") or ""
        new_password = data.get("newPassword") or ""

        if not current_password:
            return jsonify({"error": "Senha atual é obrigatória"}), 400
        if not new_password:
            return jsonify({"error": "Nova senha é obrigatória"}), 400
        if len(new_password) < 6:
            return jsonify({"error": "Nova senha deve ter no mínimo 6 caracteres"}), 400

        # Verificar senha atual (suporta SHA256 legado e werkzeug)
        if not _verify_stored_password(g.current_user["password_hash"], current_password):
            return jsonify({"error": "Senha atual incorreta"}), 401

        # Atualizar senha
        new_hash = generate_password_hash(new_password)
        execute_sql(
            "UPDATE users SET password_hash = :hash WHERE id = :id",
            {"hash": new_hash, "id": g.current_user_id},
        )

        # Revogar outras sessões (opcional, por segurança)
        execute_sql(
            """
            UPDATE user_sessions
            SET revoked_at = NOW(), revoked_reason = 'password_change'
            WHERE user_id = :user_id
              AND id != :current_session
              AND revoked_at IS NULL
            """,
            {"user_id": g.current_user_id, "current_session": g.current_session_id},
        )

        return jsonify({"message": "Senha alterada com sucesso"})

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@auth_bp.get("/me/interests")
@login_required
def get_my_interests():
    """Lista interesses do usuário logado."""
    try:
        rows = fetch_all(
            """
            SELECT ui.system_id, s.slug, s.display_name, s.icon, s.color
            FROM user_interests ui
            INNER JOIN systems s ON s.id = ui.system_id
            WHERE ui.user_id = :user_id
            ORDER BY s.display_order, s.id
            """,
            {"user_id": g.current_user_id},
        )
        return jsonify([
            {
                "systemId": r["system_id"],
                "slug": r["slug"],
                "displayName": r["display_name"],
                "icon": r["icon"],
                "color": r["color"],
            }
            for r in rows
        ])
    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@auth_bp.put("/me/interests")
@login_required
def update_my_interests():
    """Atualiza interesses do usuário (recebe { systemIds: [1,2,3] })."""
    try:
        data = request.get_json(silent=True) or {}
        system_ids = data.get("systemIds") or []

        # Limpar interesses antigos
        execute_sql(
            "DELETE FROM user_interests WHERE user_id = :user_id",
            {"user_id": g.current_user_id},
        )

        # Inserir novos
        for sys_id in system_ids:
            try:
                execute_sql(
                    """
                    INSERT INTO user_interests (user_id, system_id)
                    VALUES (:user_id, :system_id)
                    """,
                    {"user_id": g.current_user_id, "system_id": int(sys_id)},
                )
            except Exception:
                pass  # ignora system_id inválido

        return jsonify({"message": "Interesses atualizados com sucesso"})
    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@auth_bp.post("/switch-tenant")
@login_required
def switch_tenant():
    """Trocar contexto de tenant (sistema)."""
    try:
        data = request.get_json(silent=True) or {}
        tenant_id = data.get("tenantId")
        tenant_slug = (data.get("tenantSlug") or "").strip()

        if not tenant_id and not tenant_slug:
            return jsonify({"error": "tenantId ou tenantSlug é obrigatório"}), 400

        # Buscar tenant
        if tenant_id:
            tenant = fetch_one(
                "SELECT id, slug, display_name FROM tenants WHERE id = :id AND is_active = TRUE",
                {"id": tenant_id},
            )
        else:
            tenant = fetch_one(
                "SELECT id, slug, display_name FROM tenants WHERE slug = :slug AND is_active = TRUE",
                {"slug": tenant_slug},
            )

        if not tenant:
            return jsonify({"error": "Sistema não encontrado"}), 404

        # Verificar se usuário tem acesso
        membership = fetch_one(
            """
            SELECT id, role FROM user_tenants
            WHERE user_id = :user_id AND tenant_id = :tenant_id AND is_active = TRUE
            """,
            {"user_id": g.current_user_id, "tenant_id": tenant["id"]},
        )

        if not membership:
            return jsonify({"error": "Você não tem acesso a este sistema"}), 403

        # Atualizar sessão com novo contexto
        execute_sql(
            "UPDATE user_sessions SET current_tenant_id = :tenant_id WHERE id = :session_id",
            {"tenant_id": tenant["id"], "session_id": g.current_session_id},
        )

        return jsonify({
            "message": f"Contexto alterado para {tenant['display_name']}",
            "tenant": {
                "id": tenant["id"],
                "slug": tenant["slug"],
                "displayName": tenant["display_name"],
            },
            "role": membership["role"],
        })

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500
