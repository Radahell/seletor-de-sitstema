#!/bin/bash
# ============================================================
# MIGRATION RUNNER — seletor-de-sistema
# Aplica apenas as migrations pendentes, em ordem numérica.
# Registra cada migration aplicada na tabela schema_migrations.
# ============================================================
# Uso:
#   ./migrate.sh            → aplica todas as pendentes
#   ./migrate.sh --dry-run  → mostra o que seria aplicado
# ============================================================

MIGRATIONS_DIR="$(dirname "$0")/migrations"
DB_CONTAINER="seletor-sistema-db"
DB_NAME="seletor_db"
DB_USER="root"
DB_PASS="&DMforever13036619"
DRY_RUN=false

# Arquivos que NÃO são migrations de schema (seeds, dumps, etc.)
SKIP_PATTERN="seed|dump"

[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

# Verifica se o container está rodando
if ! docker inspect -f '{{.State.Running}}' "$DB_CONTAINER" 2>/dev/null | grep -q true; then
  echo "Container $DB_CONTAINER não está rodando. Iniciando..."
  docker start "$DB_CONTAINER"
  echo "Aguardando MySQL..."
  for i in $(seq 1 30); do
    docker exec "$DB_CONTAINER" mysqladmin ping -h 127.0.0.1 --silent 2>/dev/null && break
    sleep 2
  done
fi

# Cria tabela de controle se não existir
docker exec "$DB_CONTAINER" bash -c \
  "mysql -u$DB_USER '-p$DB_PASS' $DB_NAME -e \"
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  \"" 2>/dev/null

# Registra automaticamente migrations que já estão no banco
# (detecta pela existência de colunas/tabelas chave de cada migration)
_auto_register() {
  local migration="$1"
  local check_sql="$2"
  local exists
  exists=$(docker exec "$DB_CONTAINER" bash -c \
    "mysql -u$DB_USER '-p$DB_PASS' $DB_NAME -N -e \"$check_sql\"" 2>/dev/null | tr -d '[:space:]')
  if [[ "$exists" == "1" ]]; then
    docker exec "$DB_CONTAINER" bash -c \
      "mysql -u$DB_USER '-p$DB_PASS' $DB_NAME -e \"
        INSERT IGNORE INTO schema_migrations (migration) VALUES ('$migration');
      \"" 2>/dev/null
  fi
}

# Auto-registra migrations antigas já aplicadas (idempotente)
_auto_register "001_centralized_users.sql" \
  "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='users';"
_auto_register "002_add_cpf_to_users.sql" \
  "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='users' AND COLUMN_NAME='cpf';"
_auto_register "003_add_address_timezone_to_users.sql" \
  "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='users' AND COLUMN_NAME='timezone';"
_auto_register "004_centralize_user_profile.sql" \
  "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='users' AND COLUMN_NAME='bio';"
_auto_register "005_seed_users_from_dump.sql" \
  "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='users';"
_auto_register "006_seed_lances_tenant.sql" \
  "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='systems';"
_auto_register "007_add_client_role.sql" \
  "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='user_tenants' AND COLUMN_NAME='role';"
_auto_register "008_cpf_unique_constraint.sql" \
  "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='users' AND INDEX_NAME='cpf';"

echo "=========================================="
echo "  MIGRATIONS — $DB_NAME"
[[ "$DRY_RUN" == true ]] && echo "  (DRY RUN — nada será aplicado)"
echo "=========================================="

APPLIED=0
SKIPPED=0
FAILED=0

# Processa arquivos em ordem numérica
for FILE in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  FILENAME=$(basename "$FILE")

  # Pula seeds e dumps
  if echo "$FILENAME" | grep -qiE "$SKIP_PATTERN"; then
    continue
  fi

  # Verifica se já foi aplicada
  COUNT=$(docker exec "$DB_CONTAINER" bash -c \
    "mysql -u$DB_USER '-p$DB_PASS' $DB_NAME -N -e \"
      SELECT COUNT(*) FROM schema_migrations WHERE migration='$FILENAME';
    \"" 2>/dev/null)

  if [[ "$COUNT" -gt 0 ]]; then
    echo "  [já aplicada] $FILENAME"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo ""
  echo "  [APLICANDO] $FILENAME..."

  if [[ "$DRY_RUN" == true ]]; then
    echo "  (dry-run: não aplicado)"
    continue
  fi

  # Aplica a migration (captura erro sem parar o script)
  ERR=$(docker exec -i "$DB_CONTAINER" bash -c \
    "mysql -u$DB_USER '-p$DB_PASS' $DB_NAME" < "$FILE" 2>&1)

  if [[ $? -ne 0 ]]; then
    echo "  [ERRO] $FILENAME: $ERR"
    FAILED=$((FAILED + 1))
    continue
  fi

  # Registra como aplicada
  docker exec "$DB_CONTAINER" bash -c \
    "mysql -u$DB_USER '-p$DB_PASS' $DB_NAME -e \"
      INSERT INTO schema_migrations (migration) VALUES ('$FILENAME');
    \"" 2>/dev/null

  echo "  [OK] $FILENAME"
  APPLIED=$((APPLIED + 1))
done

echo ""
echo "=========================================="
echo "  $APPLIED aplicada(s) | $SKIPPED já existiam | $FAILED erro(s)"
echo "=========================================="
