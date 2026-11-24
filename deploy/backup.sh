#!/usr/bin/env bash
# Back up the production PostgreSQL database (requirement D4).
#
#   deploy/backup.sh [backup_dir]
#
# Run it on the server, from anywhere. It dumps to <backup_dir>/db_<date>.sql (default
# ~/backups) and keeps the newest KEEP files (default 14). Dumps can contain personal
# data: keep them on the server, never commit them.
#
# Environment (all optional):
#   COMPOSE_DIR      folder with compose.yaml and the deploy-time .env (default: repo root)
#   COMPOSE_PROJECT  Docker Compose project name (default: finalproject)
#   KEEP             number of backups to keep (default: 14)
set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
PROJECT="${COMPOSE_PROJECT:-finalproject}"
BACKUP_DIR="${1:-$HOME/backups}"
KEEP="${KEEP:-14}"

cd "$COMPOSE_DIR"
set -a
# shellcheck disable=SC1091
. ./.env
set +a

mkdir -p "$BACKUP_DIR"
umask 077
file="$BACKUP_DIR/db_$(date +%F_%H%M%S).sql"

docker compose -p "$PROJECT" exec -T db pg_dump -U "$DB_USER" "$DB_NAME" < /dev/null > "$file"

if [ ! -s "$file" ]; then
  echo "Backup failed: $file is empty" >&2
  rm -f "$file"
  exit 1
fi

# Rotate: keep only the newest $KEEP dumps.
ls -1t "$BACKUP_DIR"/db_*.sql | tail -n +"$((KEEP + 1))" | xargs -r rm --
echo "Backup written: $file ($(wc -c < "$file") bytes)"
