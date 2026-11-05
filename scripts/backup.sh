#!/usr/bin/env bash
# Database Backup Script (Requirement D4, Section 7.7)
set -euo pipefail

BACKUP_DIR="${HOME}/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/nutrisync_db_${TIMESTAMP}.sql"
DB_USER="${DB_USER:-nutrisync_user}"
DB_NAME="${DB_NAME:-nutrisync_db}"

mkdir -p "${BACKUP_DIR}"

echo "[NutriSync-RAG] Initiating database backup..."
docker compose -p finalproject exec -T db pg_dump -U "${DB_USER}" "${DB_NAME}" > "${BACKUP_FILE}"

echo "[NutriSync-RAG] Backup successful! Saved to: ${BACKUP_FILE}"
ls -lh "${BACKUP_FILE}"
