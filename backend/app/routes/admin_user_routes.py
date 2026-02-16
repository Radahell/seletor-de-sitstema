"""
Rotas de administração de usuários do hub (super admin only).

Endpoints:
- GET    /api/admin/users           - Lista paginada de usuários
- PATCH  /api/admin/users/<id>      - Editar usuário
- POST   /api/admin/users/<id>/activate   - Ativar
- POST   /api/admin/users/<id>/deactivate - Desativar
- DELETE /api/admin/users/<id>      - Soft delete (desativar + bloquear)
"""
from __future__ import annotations

import traceback
from functools import wraps

from flask import Blueprint, g, jsonify, request

from app.db import execute_sql, fetch_all, fetch_one, safe_db_error, ENV
from app.routes.auth_routes import login_required

admin_user_bp = Blueprint("admin_users", __name__, url_prefix="/api/admin")


def _super_admin_required(f):
    """Decorator: exige login + super admin."""
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        sa = fetch_one(
            "SELECT 1 FROM super_admins WHERE email = :email AND is_active = TRUE",
            {"email": g.current_user["email"]},
        )
        if not sa:
            return jsonify({"error": "Acesso restrito a super administradores"}), 403
        return f(*args, **kwargs)
    return decorated


def _user_to_item(row):
    """Converte row do DB para item compatível com o frontend admin."""
    return {
        "id": row["id"],
        "name": row["name"],
        "nickname": row.get("nickname"),
        "email": row["email"],
        "phone": row.get("phone"),
        "cpf": row.get("cpf"),
        "cnpj": row.get("cnpj"),
        "city": row.get("city"),
        "state": row.get("state"),
        "timezone": row.get("timezone"),
        "avatar_url": row.get("avatar_url"),
        "is_active": bool(row.get("is_active", True)),
        "is_blocked": bool(row.get("is_blocked", False)),
        "last_login_at": row["last_login_at"].isoformat() if row.get("last_login_at") else None,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "tenants": [],
    }


@admin_user_bp.get("/users")
@_super_admin_required
def list_users():
    """Lista paginada de usuários do hub."""
    try:
        page = max(1, int(request.args.get("page", 1)))
        per_page = min(100, max(1, int(request.args.get("per_page", 20))))
        offset = (page - 1) * per_page

        conditions = []
        params: dict = {}

        # Search (q)
        q = request.args.get("q", "").strip()
        if q:
            conditions.append(
                "(u.name LIKE :q OR u.email LIKE :q OR u.phone LIKE :q)"
            )
            params["q"] = f"%{q}%"

        # Status filter
        status = request.args.get("status", "").strip()
        if status == "active":
            conditions.append("u.is_active = TRUE")
        elif status == "inactive":
            conditions.append("u.is_active = FALSE")

        # Date range
        created_from = request.args.get("created_from", "").strip()
        if created_from:
            conditions.append("u.created_at >= :created_from")
            params["created_from"] = created_from

        created_to = request.args.get("created_to", "").strip()
        if created_to:
            conditions.append("u.created_at <= :created_to")
            params["created_to"] = created_to + " 23:59:59"

        # Missing contact
        if request.args.get("missing_contact") == "true":
            conditions.append("(u.phone IS NULL OR u.phone = '')")

        where = " AND ".join(conditions) if conditions else "1=1"

        # Sort
        sort_map = {
            "name": "u.name",
            "email": "u.email",
            "created_at": "u.created_at",
        }
        sort_by = sort_map.get(request.args.get("sort_by", ""), "u.name")
        sort_dir = "DESC" if request.args.get("sort_dir") == "desc" else "ASC"

        # Count
        count_row = fetch_one(
            f"SELECT COUNT(*) AS total FROM users u WHERE {where}", params
        )
        total = count_row["total"] if count_row else 0

        # Fetch users
        users = fetch_all(
            f"""
            SELECT u.*
            FROM users u
            WHERE {where}
            ORDER BY {sort_by} {sort_dir}
            LIMIT :limit OFFSET :offset
            """,
            {**params, "limit": per_page, "offset": offset},
        )

        items = [_user_to_item(u) for u in users]

        # Fetch tenants for each user in batch
        if items:
            user_ids = [u["id"] for u in items]
            placeholders = ",".join(str(uid) for uid in user_ids)
            tenants = fetch_all(
                f"""
                SELECT ut.user_id, t.id AS tenant_id, t.slug, t.display_name,
                       s.slug AS system_slug, s.display_name AS system_name,
                       ut.role
                FROM user_tenants ut
                INNER JOIN tenants t ON ut.tenant_id = t.id
                INNER JOIN systems s ON t.system_id = s.id
                WHERE ut.user_id IN ({placeholders})
                  AND ut.is_active = TRUE
                ORDER BY ut.user_id, s.display_order
                """
            )
            tenant_map: dict = {}
            for t in tenants:
                uid = t["user_id"]
                if uid not in tenant_map:
                    tenant_map[uid] = []
                tenant_map[uid].append({
                    "id": t["tenant_id"],
                    "slug": t["slug"],
                    "name": t["display_name"],
                    "system": t["system_name"],
                    "role": t["role"],
                })
            for item in items:
                item["tenants"] = tenant_map.get(item["id"], [])

        pages = max(1, (total + per_page - 1) // per_page) if total > 0 else 0

        return jsonify({
            "items": items,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": pages,
            },
        })

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@admin_user_bp.patch("/users/<int:user_id>")
@_super_admin_required
def update_user(user_id: int):
    """Atualiza dados de um usuário."""
    try:
        user = fetch_one("SELECT id FROM users WHERE id = :id", {"id": user_id})
        if not user:
            return jsonify({"error": "Usuário não encontrado"}), 404

        payload = request.get_json(force=True)
        allowed = {"name", "phone", "email", "nickname", "cpf", "cnpj",
                    "city", "state", "timezone"}
        sets = []
        params: dict = {"id": user_id}
        for field in allowed:
            if field in payload:
                sets.append(f"{field} = :{field}")
                params[field] = payload[field]

        if not sets:
            return jsonify({"error": "Nenhum campo para atualizar"}), 400

        execute_sql(
            f"UPDATE users SET {', '.join(sets)} WHERE id = :id",
            params,
        )
        updated = fetch_one("SELECT * FROM users WHERE id = :id", {"id": user_id})
        return jsonify(_user_to_item(updated))

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@admin_user_bp.post("/users/<int:user_id>/activate")
@_super_admin_required
def activate_user(user_id: int):
    """Ativar usuário."""
    try:
        execute_sql(
            "UPDATE users SET is_active = TRUE, is_blocked = FALSE WHERE id = :id",
            {"id": user_id},
        )
        return jsonify({"message": "Usuário ativado", "id": user_id})
    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@admin_user_bp.post("/users/<int:user_id>/deactivate")
@_super_admin_required
def deactivate_user(user_id: int):
    """Desativar usuário."""
    try:
        execute_sql(
            "UPDATE users SET is_active = FALSE WHERE id = :id",
            {"id": user_id},
        )
        return jsonify({"message": "Usuário desativado", "id": user_id})
    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@admin_user_bp.delete("/users/<int:user_id>")
@_super_admin_required
def delete_user(user_id: int):
    """Soft delete: desativa e bloqueia."""
    try:
        execute_sql(
            "UPDATE users SET is_active = FALSE, is_blocked = TRUE, blocked_reason = 'deleted_by_admin' WHERE id = :id",
            {"id": user_id},
        )
        return jsonify({"message": "Usuário removido", "id": user_id})
    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500
