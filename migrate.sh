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

set -e

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

echo "=========================================="
echo "  MIGRATIONS — $DB_NAME"
[[ "$DRY_RUN" == true ]] && echo "  (DRY RUN — nada será aplicado)"
echo "=========================================="

APPLIED=0
SKIPPED=0

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

  # Aplica a migration
  docker exec -i "$DB_CONTAINER" bash -c \
    "mysql -u$DB_USER '-p$DB_PASS' $DB_NAME" < "$FILE" 2>/dev/null

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
echo "  $APPLIED aplicada(s), $SKIPPED já existiam"
echo "=========================================="
