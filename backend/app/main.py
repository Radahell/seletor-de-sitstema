import os
from typing import Any, Dict

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from .db import fetch_all, fetch_one, safe_db_error

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev')

# Em prod você pode restringir origem. Como o Nginx já injeta CORS,
# isso aqui serve principalmente para DEV direto no :22002.
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=False)


def _system_row_to_dto(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": int(row["id"]),
        "slug": row["slug"],
        "displayName": row.get("display_name") or "",
        "description": row.get("description") or "",
        "iconName": row.get("icon") or "trophy",
        "primaryColor": row.get("color") or "#ef4444",
        "baseUrl": row.get("base_route") or "/",
        "isActive": bool(row.get("is_active", True)),
    }


def _tenant_row_to_dto(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": int(row["id"]),
        "slug": row["slug"],
        "displayName": row.get("display_name") or "",
        "logoUrl": row.get("logo_url"),
        "primaryColor": row.get("primary_color") or "#ef4444",
        "welcomeMessage": row.get("welcome_message"),
        "maintenanceMode": bool(row.get("maintenance_mode", False)),
    }


@app.get('/health')
def health():
    return jsonify({"ok": True})


@app.get('/api/systems')
def list_systems():
    try:
        rows = fetch_all(
            """
            SELECT id, slug, display_name, description, icon, color, base_route, is_active
            FROM systems
            ORDER BY display_order ASC, id ASC
            """
        )
        return jsonify([_system_row_to_dto(r) for r in rows])
    except Exception as e:
        return jsonify({"error": safe_db_error(e)}), 500


@app.get('/api/systems/<system_slug>/tenants')
def list_tenants_by_system(system_slug: str):
    try:
        sys_row = fetch_one(
            """
            SELECT id, display_name
            FROM systems
            WHERE slug = :slug AND is_active = TRUE
            """,
            {"slug": system_slug},
        )
        if not sys_row:
            return jsonify({"error": "Sistema não encontrado"}), 404

        tenants = fetch_all(
            """
            SELECT id, slug, display_name, logo_url, primary_color, welcome_message, maintenance_mode
            FROM tenants
            WHERE system_id = :sid AND is_active = TRUE
            ORDER BY id ASC
            """,
            {"sid": sys_row["id"]},
        )

        return jsonify({
            "systemName": sys_row.get("display_name") or system_slug,
            "tenants": [_tenant_row_to_dto(t) for t in tenants],
        })
    except Exception as e:
        return jsonify({"error": safe_db_error(e)}), 500


@app.post('/api/tenants/select')
def select_tenant():
    try:
        payload = request.get_json(silent=True) or {}
        tenant_slug = (payload.get('slug') or '').strip()
        if not tenant_slug:
            return jsonify({"error": "slug é obrigatório"}), 400

        header_system_slug = (request.headers.get('X-System-Slug') or '').strip()

        # Busca tenant + sistema
        row = fetch_one(
            """
            SELECT 
              t.id,
              t.slug,
              t.display_name,
              t.database_name,
              t.database_host,
              t.primary_color,
              t.secondary_color,
              t.accent_color,
              t.background_color,
              t.maintenance_mode,
              t.is_active,
              s.slug as system_slug,
              s.display_name as system_name
            FROM tenants t
            INNER JOIN systems s ON s.id = t.system_id
            WHERE t.slug = :tenant_slug
            """,
            {"tenant_slug": tenant_slug},
        )

        if not row:
            return jsonify({"error": "Tenant não encontrado"}), 404

        if not bool(row.get('is_active', True)):
            return jsonify({"error": "Tenant inativo"}), 403

        if bool(row.get('maintenance_mode', False)):
            return jsonify({"error": "Tenant em manutenção"}), 503

        if header_system_slug and header_system_slug != row.get('system_slug'):
            return jsonify({"error": "Tenant não pertence a esse sistema"}), 400

        dto = {
            "id": int(row["id"]),
            "slug": row["slug"],
            "displayName": row.get("display_name") or "",
            "system": {
                "slug": row.get("system_slug"),
                "displayName": row.get("system_name"),
            },
            "database": {
                "name": row.get("database_name"),
                "host": row.get("database_host") or "db",
            },
            "branding": {
                "primaryColor": row.get("primary_color") or "#ef4444",
                "secondaryColor": row.get("secondary_color") or "#f59e0b",
                "accentColor": row.get("accent_color") or "#3b82f6",
                "backgroundColor": row.get("background_color") or "#09090b",
            },
        }

        return jsonify({"tenant": dto})
    except Exception as e:
        return jsonify({"error": safe_db_error(e)}), 500
