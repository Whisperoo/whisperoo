#!/usr/bin/env bash
# Support Requests "No response" status (client tested on staging, 2026-11-20).
#
# Ships: 1 migration (status CHECK + 4 functions), the frontend. No edge functions.
# Order: migration → frontend, so the new button never calls a status prod rejects.
source "$(dirname "$0")/_common.sh"

RELEASE_VERSIONS="20261120000001"

echo "== 0. preconditions =="
[ "$(git branch --show-current)" = "main" ] || { echo "STOP: release from main"; exit 1; }
git diff --quiet -- supabase src || { echo "STOP: uncommitted changes under supabase/ or src/"; exit 1; }
flyctl auth whoami >/dev/null || { echo "STOP: run flyctl auth login"; exit 1; }
grep -qE '^VITE_CONSENT_STEP=true\s*$' .env || { echo "STOP: VITE_CONSENT_STEP=true missing from .env (the opt-in screen would disappear)"; exit 1; }

echo "== 1. backup =="
mkdir -p "$HOME/whisperoo-backups"
OUT="$HOME/whisperoo-backups/prod-public-$(date +%Y%m%d-%H%M%S)-pre-no-response.sql"
PGPASSWORD="$PROD_DB_PASSWORD" "$PGDUMP" -h "$POOLER" -p 5432 -U "postgres.$PROD_REF" -d postgres \
  --schema=public --no-owner --no-privileges -f "$OUT"
ls -la "$OUT"

echo "== 2. migration =="
PENDING="$(pending_versions)"
printf '%s\n' "$PENDING"
[ "$PENDING" = "$RELEASE_VERSIONS" ] || { echo "STOP: prod pending set is not exactly $RELEASE_VERSIONS"; exit 1; }
# The migration redefines 4 functions from copies of the originals; refuse if prod's differ.
DRIFT="$(prod_psql -At -c "select (pg_get_functiondef('public.fn_my_support_status'::regproc) like '%status <> ''done''%')
  and (pg_get_functiondef('public.fn_admin_set_support_request_status'::regproc) like '%''new'', ''in_progress'', ''done'')%')" | tr -d '\r')"
[ "$DRIFT" = "t" ] || { echo "STOP: prod support functions differ from the originals"; exit 1; }
read -r -p "Apply this migration to PRODUCTION? Type PUSH: " ans
[ "$ans" = "PUSH" ] || { echo "aborted"; exit 1; }
for v in $RELEASE_VERSIONS; do
  FILE="$(ls supabase/migrations/${v}_*.sql)"
  NAME="$(basename "$FILE" .sql | cut -c16-)"
  WRAP="$(mktemp --suffix=.sql)"
  python - "$FILE" "$v" "$NAME" "$WRAP" <<'PY'
import sys
src, v, name, out = sys.argv[1:5]
body = open(src, encoding="utf-8").read()
assert "$mig$" not in body
open(out, "w", encoding="utf-8").write(
    body + "\n\nINSERT INTO supabase_migrations.schema_migrations(version, name, statements) "
    f"VALUES ('{v}', '{name}', ARRAY[$mig${body}$mig$]) ON CONFLICT (version) DO NOTHING;\n")
PY
  echo "--- $v $NAME"
  prod_psql -1 -q -f "$WRAP" || { rm -f "$WRAP"; echo "STOP: $v failed and was rolled back"; exit 1; }
  rm -f "$WRAP"
done
prod_psql -At -c "
SELECT 'tracker', count(*)::text FROM supabase_migrations.schema_migrations
UNION ALL SELECT 'check_has_no_response', (pg_get_constraintdef(oid) LIKE '%no_response%')::text
  FROM pg_constraint WHERE conname = 'support_requests_status_check'
UNION ALL SELECT 'functions_with_no_response', count(*)::text FROM pg_proc
  WHERE proname IN ('fn_my_support_status', 'fn_admin_list_support_requests',
                    'fn_admin_set_support_request_status', 'fn_admin_set_support_request_status_bulk')
    AND prosrc LIKE '%no_response%'" | tr -d '\r'
echo "Expect: tracker=152, check_has_no_response=true, functions_with_no_response=4"

echo "== 3. frontend =="
bash scripts/prod-push/04-frontend.sh
JS="$(curl -fsSL https://app.whisperoo.app/ | grep -o '/assets/index-[^"]*\.js' | head -1)"
B="$(mktemp)"; curl -fsSL "https://app.whisperoo.app$JS" -o "$B"
for p in markNoResponse brevo-contact-sync 'VITE_CONSENT_STEP:"true"'; do
  grep -qF "$p" "$B" && echo "PASS  $p" || { echo "FAIL  $p"; FAILED=1; }
done
rm -f "$B"
[ "${FAILED:-0}" -eq 0 ] && echo "Release complete." || { echo "Bundle check FAILED — flyctl releases rollback -a whisperoo-app"; exit 1; }
