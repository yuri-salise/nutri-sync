#!/usr/bin/env bash
# Database Restore Script (Requirement D4, Section 7.7)
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <path_to_backup_file.sql>"
  exit 1
fi

BACKUP_FILE="$1"
DB_USER="${DB_USER:-nutrisync_user}"
DB_NAME="${DB_NAME:-nutrisync_db}"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file '${BACKUP_FILE}' not found."
  exit 1
fi

echo "[NutriSync-RAG] Restoring database '${DB_NAME}' from '${BACKUP_FILE}'..."
cat "${BACKUP_FILE}" | docker compose -p finalproject exec -T db psql -U "${DB_USER}" "${DB_NAME}"

echo "[NutriSync-RAG] Restore complete! Verifying row counts..."
docker compose -p finalproject exec -T db psql -U "${DB_USER}" -d "${DB_NAME}" -c "
  SELECT 'users' AS table_name, count(*) FROM users
  UNION ALL
  SELECT 'nutrition_knowledge_items', count(*) FROM nutrition_knowledge_items
  UNION ALL
  SELECT 'workout_sessions', count(*) FROM workout_sessions;
"
