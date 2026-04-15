#!/usr/bin/env bash
#
# Backup api/dashboard.db to backups/ with a timestamped name.
# Keeps the 7 most recent backups and deletes older ones.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DB_PATH="$PROJECT_ROOT/api/dashboard.db"
BACKUP_DIR="$PROJECT_ROOT/backups"

if [ ! -f "$DB_PATH" ]; then
  echo "ERROR: Database not found at $DB_PATH"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M")
BACKUP_NAME="dashboard_${TIMESTAMP}.db"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

cp "$DB_PATH" "$BACKUP_PATH"
echo "Created backup: $BACKUP_PATH"

# Keep only the 7 most recent backups, delete the rest
BACKUP_COUNT=$(ls -1t "$BACKUP_DIR"/dashboard_*.db 2>/dev/null | wc -l | tr -d ' ')
if [ "$BACKUP_COUNT" -gt 7 ]; then
  DELETED=$(ls -1t "$BACKUP_DIR"/dashboard_*.db | tail -n +8)
  echo "$DELETED" | while read -r old_backup; do
    rm -f "$old_backup"
    echo "Deleted old backup: $old_backup"
  done
fi

REMAINING=$(ls -1t "$BACKUP_DIR"/dashboard_*.db 2>/dev/null | wc -l | tr -d ' ')
echo "Done. $REMAINING backup(s) in $BACKUP_DIR"
