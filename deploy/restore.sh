#!/usr/bin/env bash
# Restore a backup made by deploy/backup.sh into a database (requirement D4).
#
#   deploy/restore.sh <backup.sql> [target_db] [--drop-after]
#
# target_db defaults to "<DB_NAME>_restore_test", so a restore test never touches the
# live database. The target is created if it does not exist and must be empty. To restore
# for real after a disaster, stop the api container, pass the real database name (empty
# or freshly created), then start the api again.
# --drop-after removes the target database once the row counts are printed (for tests).
#
# Environment (all optional): COMPOSE_DIR, COMPOSE_PROJECT as in backup.sh.
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: $0 <backup.sql> [target_db] [--drop-after]" >&2
  exit 2
fi

BACKUP="$1"
shift
COMPOSE_DIR="${COMPOSE_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
PROJECT="${COMPOSE_PROJECT:-finalproject}"

cd "$COMPOSE_DIR"
set -a
# shellcheck disable=SC1091
. ./.env
set +a

TARGET="${DB_NAME}_restore_test"
DROP_AFTER=0
for arg in "$@"; do
  case "$arg" in
    --drop-after) DROP_AFTER=1 ;;
    *) TARGET="$arg" ;;
  esac
done

# psql_db ignores stdin (so it cannot swallow a caller's input); psql_import reads the dump.
psql_db() { docker compose -p "$PROJECT" exec -T db psql -U "$DB_USER" -v ON_ERROR_STOP=1 "$@" < /dev/null; }
psql_import() { docker compose -p "$PROJECT" exec -T db psql -U "$DB_USER" -v ON_ERROR_STOP=1 "$@"; }

psql_db -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$TARGET'" | grep -q 1 \
  || psql_db -d postgres -c "CREATE DATABASE \"$TARGET\""

psql_import -d "$TARGET" -q < "$BACKUP" > /dev/null

echo "Restored $BACKUP into database $TARGET. Row counts (restored vs live):"
for table in users nutrition_knowledge_items workout_sessions run_activities rag_scan_logs; do
  restored=$(psql_db -d "$TARGET" -tAc "SELECT count(*) FROM $table")
  live=$(psql_db -d "$DB_NAME" -tAc "SELECT count(*) FROM $table")
  printf '  %-28s restored=%-8s live=%s\n' "$table" "$restored" "$live"
done
echo "Schema version: $(psql_db -d "$TARGET" -tAc 'SELECT version_num FROM alembic_version')"

if [ "$DROP_AFTER" -eq 1 ]; then
  psql_db -d postgres -c "DROP DATABASE \"$TARGET\"" > /dev/null
  echo "Dropped test database $TARGET."
fi
