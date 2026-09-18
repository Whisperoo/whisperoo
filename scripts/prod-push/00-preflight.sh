#!/usr/bin/env bash
# Phase 0 — no prod changes. Links the CLI to prod and takes a backup.
source "$(dirname "$0")/_common.sh"

echo "== git =="
git status --short | grep -v '^ M supabase/.temp' || true
git log --oneline -1

echo "== fly =="
flyctl auth whoami

echo "== link CLI to PROD =="
supabase link --project-ref "$PROD_REF" --password "$PROD_DB_PASSWORD"
assert_linked_prod
echo "linked: $(cat supabase/.temp/project-ref)"

echo "== backup (schema + data, public schema) =="
mkdir -p "$HOME/whisperoo-backups"
OUT="$HOME/whisperoo-backups/prod-public-$(date +%Y%m%d-%H%M%S).sql"
PGPASSWORD="$PROD_DB_PASSWORD" "$PGDUMP" -h "$POOLER" -p 5432 -U "postgres.$PROD_REF" -d postgres \
  --schema=public --no-owner --no-privileges -f "$OUT"
ls -la "$OUT"

echo "== tracker state before repair =="
prod_psql -c "select count(*) from supabase_migrations.schema_migrations;"
echo "Expect 89. Phase 0 done."
