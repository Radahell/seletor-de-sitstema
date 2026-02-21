from __future__ import annotations

import os
import fnmatch
import re
import traceback
import datetime
import jwt
from functools import wraps
from urllib.parse import quote
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import create_engine, text
from app.security import hash_password

from app.db import (
    init_db,
    execute_sql,
    fetch_one,
    fetch_all,
    safe_db_error,
    validate_slug,
    build_db_name_from_slug,
    create_physical_database,
    drop_physical_database,
    build_tenant_database_url,
    apply_sql_template,
    TEMPLATES_DIR,
    TENANT_DB_HOST,
)

# ------------------------------------------------------------
# Config
# ------------------------------------------------------------
load_dotenv()

ENV = os.getenv("ENV", "dev")
JWT_SECRET = os.getenv("JWT_SECRET") or ""
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET is required (env var).")

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev")

DOWNLOADS_DIR = os.path.abspath(os.path.expanduser(os.getenv("DOWNLOADS_DIR", "/downloads")))

if not os.path.isdir(DOWNLOADS_DIR):
    print(f"⚠️ DOWNLOADS_DIR não encontrado: {DOWNLOADS_DIR}", flush=True)

CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=False)

# ------------------------------------------------------------
# STARTUP (MASTER DB do Seletor)
# ------------------------------------------------------------
try:
    print("--> Iniciando verificação do banco MASTER (Seletor)...", flush=True)
    init_db()
    print("--> Banco MASTER verificado!", flush=True)
except Exception as e:
    print(f"🚨 ERRO AO INICIAR BANCO MASTER: {e}", flush=True)


# ------------------------------------------------------------
# Decorators
# ------------------------------------------------------------
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        if "Authorization" in request.headers:
            raw = request.headers.get("Authorization", "")
            parts = raw.split(" ")
            token = parts[1] if len(parts) > 1 else parts[0]

        if not token:
            return jsonify({"error": "Token de autenticação ausente!"}), 401

        try:
            jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expirado! Faça login novamente."}), 401
        except Exception:
            return jsonify({"error": "Token inválido!"}), 401

        return f(*args, **kwargs)

    return decorated


# ------------------------------------------------------------
# DTO Helpers
# ------------------------------------------------------------
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


# ------------------------------------------------------------
# Public routes
# ------------------------------------------------------------
@app.get("/health")
def health():
    return jsonify({"ok": True})


@app.get("/downloads/<path:filename>")
def serve_download(filename: str):
    """Serve arquivos de /downloads (APKs, etc)."""
    response = send_from_directory(DOWNLOADS_DIR, filename)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["CDN-Cache-Control"] = "no-store"
    response.headers["Cloudflare-CDN-Cache-Control"] = "no-store"
    response.headers["Content-Disposition"] = f"attachment; filename={filename}"
    return response


@app.get("/api/downloads")
def list_downloads():
    """Lista APKs disponíveis no diretório compartilhado /downloads."""
    if not os.path.isdir(DOWNLOADS_DIR):
        return jsonify({"files": []})

    files = []
    for entry in os.scandir(DOWNLOADS_DIR):
        if not entry.is_file():
            continue
        if not entry.name.lower().endswith(".apk"):
            continue

        stat = entry.stat()
        files.append(
            {
                "name": entry.name,
                "size": stat.st_size,
                "updatedAt": datetime.datetime.fromtimestamp(
                    stat.st_mtime, tz=datetime.timezone.utc
                ).isoformat(),
            }
        )

    files.sort(key=lambda item: item["updatedAt"], reverse=True)
    return jsonify({"files": files})




def _find_latest_apk(pattern: str) -> Optional[Dict[str, Any]]:
    if not os.path.isdir(DOWNLOADS_DIR):
        return None

    matches = []
    for entry in os.scandir(DOWNLOADS_DIR):
        if not entry.is_file():
            continue
        if not entry.name.lower().endswith(".apk"):
            continue
        if not fnmatch.fnmatch(entry.name.lower(), pattern.lower()):
            continue

        stat = entry.stat()
        matches.append((entry.name, stat.st_mtime, stat.st_size))

    if not matches:
        return None

    matches.sort(key=lambda item: item[1], reverse=True)
    name, mtime, size = matches[0]
    return {
        "name": name,
        "size": size,
        "updatedAt": datetime.datetime.fromtimestamp(
            mtime, tz=datetime.timezone.utc
        ).isoformat(),
        "downloadUrl": f"/seletor-api/downloads/{quote(name)}",
    }


@app.get("/api/downloads/resolve")
def resolve_download():
    app_key = (request.args.get("app") or "").strip().lower()

    patterns = {
        "varzea-prime": "AppVarzeaPrime*.apk",
        "lance-de-ouro": "AppLanceDeOuro*.apk",
    }

    pattern = patterns.get(app_key)
    if not pattern:
        return jsonify({"error": "App inválido"}), 400

    match = _find_latest_apk(pattern)
    if not match:
        return jsonify({"error": "APK não encontrado para este app"}), 404

    return jsonify({"file": match})


@app.get("/api/systems")
def list_systems():
    try:
        rows = fetch_all(
            """
            SELECT id, slug, display_name, description, icon, color, base_route, is_active
            FROM systems
            WHERE is_active = 1
            ORDER BY display_order ASC, id ASC
            """
        )
        return jsonify([_system_row_to_dto(r) for r in rows])
    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@app.get("/api/systems/<system_slug>/tenants")
def list_tenants_by_system(system_slug: str):
    try:
        sys_row = fetch_one(
            "SELECT id, display_name FROM systems WHERE slug = :slug AND is_active = 1",
            {"slug": system_slug},
        )
        if not sys_row:
            return jsonify({"error": "Sistema não encontrado"}), 404

        tenants = fetch_all(
            """
            SELECT id, slug, display_name, logo_url, primary_color, welcome_message, maintenance_mode
            FROM tenants
            WHERE system_id = :sid AND is_active = 1
            ORDER BY id ASC
            """,
            {"sid": sys_row["id"]},
        )

        return jsonify(
            {
                "systemName": sys_row.get("display_name") or system_slug,
                "tenants": [_tenant_row_to_dto(t) for t in tenants],
            }
        )
    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@app.post("/api/tenants/select")
def select_tenant():
    """
    Apenas retorna os dados do tenant selecionado (para o frontend salvar).
    O sistema de verdade (Varzea) vai usar X-Tenant-Slug e resolver o DB lá.
    """
    try:
        payload = request.get_json(silent=True) or {}
        tenant_slug = (payload.get("slug") or "").strip()
        if not tenant_slug:
            return jsonify({"error": "slug é obrigatório"}), 400

        header_system_slug = (request.headers.get("X-System-Slug") or "").strip()

        row = fetch_one(
            """
            SELECT 
              t.id, t.slug, t.display_name, t.database_name, t.database_host,
              t.primary_color, t.maintenance_mode, t.is_active,
              s.slug as system_slug, s.display_name as system_name
            FROM tenants t
            INNER JOIN systems s ON s.id = t.system_id
            WHERE t.slug = :tenant_slug
            """,
            {"tenant_slug": tenant_slug},
        )

        if not row:
            return jsonify({"error": "Tenant não encontrado"}), 404
        if not bool(row.get("is_active", True)):
            return jsonify({"error": "Tenant inativo"}), 403
        if bool(row.get("maintenance_mode", False)):
            return jsonify({"error": "Tenant em manutenção"}), 503
        if header_system_slug and header_system_slug != row.get("system_slug"):
            return jsonify({"error": "Tenant não pertence a esse sistema"}), 400

        dto = {
            "id": int(row["id"]),
            "slug": row["slug"],
            "displayName": row.get("display_name") or "",
            "system": {"slug": row.get("system_slug"), "displayName": row.get("system_name")},
            "database": {
                "name": row.get("database_name"),
                "host": row.get("database_host") or TENANT_DB_HOST,
            },
            "branding": {
                "primaryColor": row.get("primary_color") or "#ef4444",
                "secondaryColor": "#f59e0b",
                "accentColor": "#3b82f6",
                "backgroundColor": "#09090b",
            },
        }
        return jsonify({"tenant": dto})
    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


# ------------------------------------------------------------
# Super Admin routes
# ------------------------------------------------------------
@app.post("/api/super-admin/login")
def super_admin_login():
    data = request.get_json(silent=True) or {}
    if not data.get("email") or not data.get("password"):
        return jsonify({"error": "Email e senha obrigatórios"}), 400

    admin = fetch_one("SELECT * FROM super_admins WHERE email = :email", {"email": data["email"]})
    if not admin:
        return jsonify({"error": "Credenciais inválidas"}), 401

    if check_password_hash(admin["password_hash"], data["password"]):
        token = jwt.encode(
            {
                "user_id": admin["id"],
                "email": admin["email"],
                "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24),
            },
            JWT_SECRET,
            algorithm="HS256",
        )

        return jsonify({"token": token, "name": admin.get("name") or "Admin", "message": "Login realizado"})
    return jsonify({"error": "Credenciais inválidas"}), 401


@app.post("/api/super-admin/create-tenant")
@token_required

def create_tenant():
    """
    Cria:
    1) registro em tenants (MASTER DB do Seletor)
    2) database físico no MySQL do Varzea (TENANT_DB_HOST)
    3) aplica template SQL (backend/app/templates_sql/model_<systemSlug>.sql)
    4) cria usuário admin no DB do tenant

    Importante:
    - Se qualquer etapa falhar, faz rollback compensatório (remove registro do MASTER e dropa o DB físico se já tiver sido criado).
    """
    data = request.get_json(silent=True) or {}

    inserted_master = False
    created_db = False
    slug = None
    db_name = None
    target_host = None

    try:
        if not data.get("slug") or not data.get("systemSlug"):
            return jsonify({"error": "Slug e systemSlug são obrigatórios"}), 400

        slug = validate_slug(data["slug"])
        system_slug = (data["systemSlug"] or "").strip().lower()

        # Valida system
        system = fetch_one("SELECT id FROM systems WHERE slug = :slug", {"slug": system_slug})
        if not system:
            return jsonify({"error": "Sistema inválido"}), 400

        # Evita duplicidade de slug
        exists = fetch_one("SELECT id FROM tenants WHERE slug = :slug", {"slug": slug})
        if exists:
            return jsonify({"error": "Este slug já está em uso."}), 409

        # Nome físico do novo DB
        db_name = build_db_name_from_slug(slug)

        # Host destino onde o DB vai nascer (MySQL do Varzea)
        target_host = os.getenv("TENANT_DB_HOST", TENANT_DB_HOST)

        # 1) insere no MASTER do seletor
        execute_sql(
            """
            INSERT INTO tenants (
                system_id, slug, display_name, database_name, database_host,
                primary_color, is_active, allow_registration
            ) VALUES (
                :system_id, :slug, :display_name, :db_name, :db_host,
                :color, 1, 1
            )
            """,
            {
                "system_id": system["id"],
                "slug": slug,
                "display_name": data.get("displayName", slug),
                "db_name": db_name,
                "db_host": target_host,
                "color": data.get("primaryColor", "#ef4444"),
            },
        )
        inserted_master = True

        # 2) cria DB físico no Varzea MySQL
        print(f"--> Criando DB `{db_name}` em {target_host}...", flush=True)
        create_physical_database(target_host, db_name)
        created_db = True

        # 3) conecta no DB do tenant e aplica template
        tenant_url = build_tenant_database_url(target_host, db_name)
        tenant_engine = create_engine(tenant_url, pool_pre_ping=True, future=True)

        template_path = TEMPLATES_DIR / f"model_{system_slug}.sql"

        with tenant_engine.begin() as conn:
            if template_path.exists():
                print(f"--> Aplicando template: {template_path}", flush=True)
                apply_sql_template(conn, template_path)
            else:
                # fallback mínimo
                print("--> Template não encontrado. Criando tabela genérica users.", flush=True)
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS users (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            name VARCHAR(100),
                            email VARCHAR(100) UNIQUE,
                            password_hash VARCHAR(255),
                            role VARCHAR(20) DEFAULT 'admin',
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                        """
                    )
                )

            # 4) cria admin no DB do tenant
            admin_email = data.get("adminEmail", f"admin@{slug}.com")
            admin_pass = data.get("adminPassword", "123")
            admin_name = data.get("adminName", "Super Admin")
            admin_nickname = data.get("adminNickname", "Super Admin")

            pass_hash = hash_password(admin_pass)

            if system_slug == "jogador":
                # User direto (sem Player separado - pos-merge v2)
                conn.exec_driver_sql(
                    """
                    INSERT INTO users (
                        email, password_hash,
                        is_admin, is_approved, is_blocked, is_monthly,
                        name, nickname, phone, photo,
                        skill_rating
                    )
                    VALUES (
                        %s, %s,
                        1, 1, 0, 0,
                        %s, %s, NULL, NULL,
                        0.0
                    )
                    """,
                    (admin_email, pass_hash, admin_name, admin_nickname),
                )
            else:
                # generico (outros sistemas: quadra, arbitro, etc)
                conn.exec_driver_sql(
                    """
                    INSERT INTO users (name, email, password_hash, role)
                    VALUES (%s, %s, %s, 'admin')
                    """,
                    (admin_name, admin_email, pass_hash),
                )
        # 5) Cria/encontra user no HUB e vincula membership com role='admin'
        hub_user = fetch_one(
            "SELECT id FROM users WHERE email = :email",
            {"email": admin_email},
        )

        if hub_user:
            hub_user_id = hub_user["id"]
        else:
            execute_sql(
                """
                INSERT INTO users (name, nickname, email, password_hash, is_active)
                VALUES (:name, :nickname, :email, :pass_hash, TRUE)
                """,
                {
                    "name": admin_name,
                    "nickname": admin_nickname,
                    "email": admin_email,
                    "pass_hash": pass_hash,
                },
            )
            hub_user = fetch_one(
                "SELECT id FROM users WHERE email = :email",
                {"email": admin_email},
            )
            hub_user_id = hub_user["id"]

        # Busca o tenant_id recém-criado no master
        tenant_row = fetch_one(
            "SELECT id FROM tenants WHERE slug = :slug",
            {"slug": slug},
        )
        tenant_id = tenant_row["id"]

        # Cria membership: admin deste tenant
        execute_sql(
            """
            INSERT INTO user_tenants (user_id, tenant_id, role, is_active)
            VALUES (:user_id, :tenant_id, 'admin', TRUE)
            ON DUPLICATE KEY UPDATE role = 'admin', is_active = TRUE
            """,
            {"user_id": hub_user_id, "tenant_id": tenant_id},
        )

        # 6) Atualiza fk_id_user_hub no user local do tenant
        try:
            with tenant_engine.begin() as conn2:
                conn2.exec_driver_sql(
                    "UPDATE users SET fk_id_user_hub = %s WHERE email = %s",
                    (hub_user_id, admin_email),
                )
        except Exception as hub_link_err:
            print(f"⚠️  fk_id_user_hub não atualizado (coluna pode não existir): {hub_link_err}", flush=True)

        return (
            jsonify(
                {
                    "message": "Tenant criado com sucesso no Varzea DB!",
                    "tenant": {"slug": slug, "database": db_name, "admin": admin_email, "host": target_host},
                }
            ),
            201,
        )

    except Exception as e:
        # rollback compensatório (sem depender de transação entre bancos)
        if ENV == "dev":
            traceback.print_exc()

        # 1) drop DB físico se já foi criado
        if created_db and target_host and db_name:
            try:
                print(f"!! ROLLBACK: drop database `{db_name}` em {target_host}", flush=True)
                drop_physical_database(target_host, db_name)
            except Exception as drop_err:
                print(f"!! ROLLBACK falhou ao dropar DB `{db_name}`: {drop_err}", flush=True)

        # 2) remove registro do MASTER se já inseriu
        if inserted_master and slug:
            try:
                print(f"!! ROLLBACK: removendo tenant `{slug}` do MASTER", flush=True)
                execute_sql("DELETE FROM tenants WHERE slug = :slug", {"slug": slug})
            except Exception as del_err:
                print(f"!! ROLLBACK falhou ao deletar tenant `{slug}` do MASTER: {del_err}", flush=True)

        # resposta
        if ENV == "dev":
            return jsonify({"error": str(e)}), 500
        return jsonify({"error": "Erro ao criar tenant"}), 500


@app.get("/api/super-admin/tenants")
@token_required
def list_all_tenants_admin():
    try:
        sql = """
        SELECT t.id, t.slug, t.display_name, t.database_name, t.database_host, t.is_active,
               s.display_name as system_name
        FROM tenants t
        JOIN systems s ON t.system_id = s.id
        ORDER BY t.id DESC
        """
        rows = fetch_all(sql)

        results = []
        for r in rows:
            results.append(
                {
                    "id": r["id"],
                    "slug": r["slug"],
                    "displayName": r["display_name"],
                    "databaseName": r["database_name"],
                    "databaseHost": r.get("database_host"),
                    "systemName": r["system_name"],
                    "isActive": bool(r["is_active"]),
                }
            )

        return jsonify(results)
    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@app.delete("/api/super-admin/tenants/<int:tenant_id>")
@token_required
def delete_tenant(tenant_id: int):
    """
    Remove:
    1) DB físico no MySQL do Varzea (host do tenant)
    2) registro do tenant no MASTER DB do Seletor
    """
    try:
        tenant = fetch_one(
            "SELECT id, database_name, database_host, display_name FROM tenants WHERE id = :id",
            {"id": tenant_id},
        )
        if not tenant:
            return jsonify({"error": "Tenant não encontrado"}), 404

        db_name = tenant["database_name"]
        db_host = tenant.get("database_host") or TENANT_DB_HOST

        # 1) drop no host CERTO (MySQL do Varzea)
        print(f"--> Drop database `{db_name}` em {db_host}...", flush=True)
        drop_physical_database(db_host, db_name)

        # 2) remove registro
        execute_sql("DELETE FROM tenants WHERE id = :id", {"id": tenant_id})

        return jsonify({"message": f"Sistema '{tenant.get('display_name')}' e banco foram excluídos."})
    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500
        return jsonify({"error": "Erro ao deletar tenant"}), 500


@app.patch("/api/super-admin/tenants/<int:tenant_id>")
@token_required
def update_tenant(tenant_id: int):
    """Edita campos do tenant: display_name, primary_color, allow_registration, is_active."""
    try:
        tenant = fetch_one("SELECT id FROM tenants WHERE id = :id", {"id": tenant_id})
        if not tenant:
            return jsonify({"error": "Tenant não encontrado"}), 404

        data = request.get_json(silent=True) or {}
        allowed = {"display_name", "primary_color", "allow_registration", "is_active"}
        sets = []
        params: dict = {"id": tenant_id}

        for field in allowed:
            camel = field.replace("_", " ").title().replace(" ", "")
            camel = camel[0].lower() + camel[1:]  # camelCase
            if camel in data:
                sets.append(f"{field} = :{field}")
                params[field] = data[camel]

        if not sets:
            return jsonify({"error": "Nenhum campo para atualizar"}), 400

        execute_sql(
            f"UPDATE tenants SET {', '.join(sets)} WHERE id = :id",
            params,
        )
        return jsonify({"message": "Tenant atualizado"})

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@app.get("/api/super-admin/tenants/<int:tenant_id>/admins")
@token_required
def list_tenant_admins(tenant_id: int):
    """Lista usuários admin de um tenant (via user_tenants com role=admin)."""
    try:
        tenant = fetch_one(
            "SELECT id, slug, display_name FROM tenants WHERE id = :id",
            {"id": tenant_id},
        )
        if not tenant:
            return jsonify({"error": "Tenant não encontrado"}), 404

        admins = fetch_all(
            """
            SELECT u.id, u.name, u.email, u.phone, ut.role, ut.is_active,
                   ut.joined_at
            FROM user_tenants ut
            INNER JOIN users u ON ut.user_id = u.id
            WHERE ut.tenant_id = :tenant_id AND ut.role = 'admin'
            ORDER BY u.name
            """,
            {"tenant_id": tenant_id},
        )

        return jsonify([
            {
                "id": a["id"],
                "name": a["name"],
                "email": a["email"],
                "phone": a.get("phone"),
                "role": a["role"],
                "isActive": bool(a.get("is_active", True)),
                "joinedAt": a["joined_at"].isoformat() if a.get("joined_at") else None,
            }
            for a in admins
        ])

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@app.put("/api/super-admin/tenants/<int:tenant_id>/admins/<int:user_id>/role")
@token_required
def update_tenant_user_role(tenant_id: int, user_id: int):
    """Altera role de um membro do tenant (admin/player/staff)."""
    try:
        data = request.get_json(silent=True) or {}
        new_role = data.get("role", "").strip()
        if new_role not in ("admin", "player", "staff", "manager"):
            return jsonify({"error": "Role inválido"}), 400

        result = fetch_one(
            "SELECT id FROM user_tenants WHERE tenant_id = :tid AND user_id = :uid",
            {"tid": tenant_id, "uid": user_id},
        )
        if not result:
            return jsonify({"error": "Usuário não é membro deste tenant"}), 404

        execute_sql(
            "UPDATE user_tenants SET role = :role WHERE tenant_id = :tid AND user_id = :uid",
            {"role": new_role, "tid": tenant_id, "uid": user_id},
        )
        return jsonify({"message": f"Role atualizado para '{new_role}'"})

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@app.get("/api/super-admin/tenants/<int:tenant_id>/members")
@token_required
def list_tenant_members(tenant_id: int):
    """Lista todos os membros de um tenant."""
    try:
        tenant = fetch_one("SELECT id FROM tenants WHERE id = :id", {"id": tenant_id})
        if not tenant:
            return jsonify({"error": "Tenant não encontrado"}), 404

        members = fetch_all(
            """
            SELECT u.id, u.name, u.email, u.phone, ut.role, ut.is_active,
                   ut.joined_at
            FROM user_tenants ut
            INNER JOIN users u ON ut.user_id = u.id
            WHERE ut.tenant_id = :tenant_id
            ORDER BY FIELD(ut.role, 'admin', 'manager', 'staff', 'player'), u.name
            """,
            {"tenant_id": tenant_id},
        )

        return jsonify([
            {
                "id": m["id"],
                "name": m["name"],
                "email": m["email"],
                "phone": m.get("phone"),
                "role": m["role"],
                "isActive": bool(m.get("is_active", True)),
                "joinedAt": m["joined_at"].isoformat() if m.get("joined_at") else None,
            }
            for m in members
        ])

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


# ------------------------------------------------------------
# Super-Admin: CRUD de Systems (tipos de sistema)
# ------------------------------------------------------------
@app.get("/api/super-admin/systems")
@token_required
def list_all_systems():
    """Lista todos os sistemas (ativos e inativos) para o super admin."""
    try:
        rows = fetch_all(
            """
            SELECT id, slug, display_name, description, icon, color, base_route, is_active, display_order
            FROM systems
            ORDER BY display_order ASC, id ASC
            """
        )
        return jsonify([
            {
                **_system_row_to_dto(r),
                "displayOrder": r.get("display_order", 0),
            }
            for r in rows
        ])
    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@app.post("/api/super-admin/systems")
@token_required
def create_system():
    """Cria um novo tipo de sistema."""
    try:
        data = request.get_json(silent=True) or {}
        required = ["slug", "displayName"]
        for f in required:
            if not data.get(f):
                return jsonify({"error": f"Campo '{f}' obrigatorio"}), 400

        existing = fetch_one("SELECT id FROM systems WHERE slug = :slug", {"slug": data["slug"]})
        if existing:
            return jsonify({"error": f"Slug '{data['slug']}' ja existe"}), 409

        execute_sql(
            """
            INSERT INTO systems (slug, display_name, description, icon, color, base_route, is_active, display_order)
            VALUES (:slug, :display_name, :description, :icon, :color, :base_route, :is_active, :display_order)
            """,
            {
                "slug": data["slug"],
                "display_name": data["displayName"],
                "description": data.get("description", ""),
                "icon": data.get("icon", "trophy"),
                "color": data.get("color", "#ef4444"),
                "base_route": data.get("baseRoute", f"/{data['slug']}"),
                "is_active": data.get("isActive", True),
                "display_order": data.get("displayOrder", 0),
            },
        )
        return jsonify({"message": f"Sistema '{data['displayName']}' criado"})

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@app.patch("/api/super-admin/systems/<int:system_id>")
@token_required
def update_system(system_id: int):
    """Edita campos de um sistema."""
    try:
        sys_row = fetch_one("SELECT id FROM systems WHERE id = :id", {"id": system_id})
        if not sys_row:
            return jsonify({"error": "Sistema nao encontrado"}), 404

        data = request.get_json(silent=True) or {}
        field_map = {
            "displayName": "display_name",
            "description": "description",
            "icon": "icon",
            "color": "color",
            "baseRoute": "base_route",
            "isActive": "is_active",
            "displayOrder": "display_order",
        }

        sets = []
        params: dict = {"id": system_id}
        for camel, db_field in field_map.items():
            if camel in data:
                sets.append(f"{db_field} = :{db_field}")
                params[db_field] = data[camel]

        if not sets:
            return jsonify({"error": "Nenhum campo para atualizar"}), 400

        execute_sql(
            f"UPDATE systems SET {', '.join(sets)} WHERE id = :id",
            params,
        )
        return jsonify({"message": "Sistema atualizado"})

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


@app.delete("/api/super-admin/systems/<int:system_id>")
@token_required
def delete_system(system_id: int):
    """Desativa um sistema (soft delete). Nao apaga tenants existentes."""
    try:
        sys_row = fetch_one("SELECT id, display_name FROM systems WHERE id = :id", {"id": system_id})
        if not sys_row:
            return jsonify({"error": "Sistema nao encontrado"}), 404

        tenant_count = fetch_one(
            "SELECT COUNT(*) as cnt FROM tenants WHERE system_id = :id AND is_active = 1",
            {"id": system_id},
        )
        if tenant_count and int(tenant_count["cnt"]) > 0:
            return jsonify({"error": f"Sistema tem {tenant_count['cnt']} tenant(s) ativo(s). Desative-os primeiro."}), 409

        execute_sql("UPDATE systems SET is_active = 0 WHERE id = :id", {"id": system_id})
        return jsonify({"message": f"Sistema '{sys_row['display_name']}' desativado"})

    except Exception as e:
        if ENV == "dev":
            traceback.print_exc()
        return jsonify({"error": safe_db_error(e)}), 500


# ------------------------------------------------------------
# Registrar Blueprints de Autenticação Centralizada
# ------------------------------------------------------------
from app.routes.auth_routes import auth_bp
from app.routes.membership_routes import membership_bp
from app.routes.user_routes import user_bp
from app.routes.admin_user_routes import admin_user_bp

app.register_blueprint(auth_bp)
app.register_blueprint(membership_bp)
app.register_blueprint(user_bp)
app.register_blueprint(admin_user_bp)
