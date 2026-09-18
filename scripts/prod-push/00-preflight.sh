#!/usr/bin/env bash
# Phase 0 — no prod changes. Backup + tracker baseline.
#
# The management-API path (`supabase link`) is refused for this account's token, so
# phases 0–2 talk to prod over psql directly. That is what the CLI does underneath:
# run each migration file in one transaction and insert a tracker row.
source "$(dirname "$0")/_common.sh"

echo "== git =="
git status --short | grep -v '^ M supabase/.temp' || true
git log --oneline -1

echo "== fly =="
flyctl auth whoami

echo "== prod reachable =="
prod_psql -c "select current_database(), current_user, now();"

echo "== backup (schema + data, public schema) =="
mkdir -p "$HOME/whisperoo-backups"
OUT="$HOME/whisperoo-backups/prod-public-$(date +%Y%m%d-%H%M%S).sql"
PGPASSWORD="$PROD_DB_PASSWORD" "$PGDUMP" -h "$POOLER" -p 5432 -U "postgres.$PROD_REF" -d postgres \
  --schema=public --no-owner --no-privileges -f "$OUT"
ls -la "$OUT"

echo "== tracker state before repair =="
prod_psql -c "select count(*) from supabase_migrations.schema_migrations;"
echo "Expect 89."
echo "== pending (local files with no tracker row) =="
pending_versions | wc -l
echo "Expect 56 (42 already applied via SQL Editor + 14 genuinely new). Phase 0 done."
