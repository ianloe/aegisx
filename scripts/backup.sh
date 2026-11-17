#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

PG_USER="${POSTGRES_USER:-aegisx}"
PG_DB="${POSTGRES_DB:-aegisx_governance}"
OUT_FILE="${BACKUP_DIR}/aegisx_${TIMESTAMP}.dump"

echo "Creating PostgreSQL backup: ${OUT_FILE}"
docker compose exec -T db pg_dump -U "$PG_USER" -d "$PG_DB" -Fc > "$OUT_FILE"

echo "Backup completed successfully: ${OUT_FILE}"
