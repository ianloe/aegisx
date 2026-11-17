#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path-to-backup.dump>"
  exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

PG_USER="${POSTGRES_USER:-aegisx}"
PG_DB="${POSTGRES_DB:-aegisx_governance}"

echo "Restoring PostgreSQL backup from: ${BACKUP_FILE}"
docker compose exec -T db pg_restore -U "$PG_USER" -d "$PG_DB" --clean --if-exists --no-owner < "$BACKUP_FILE"

echo "Restore completed successfully."
