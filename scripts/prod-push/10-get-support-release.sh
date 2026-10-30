#!/usr/bin/env bash
# Get Support release (client sign-off on staging, 2026-10-26).
#
# Ships: 5 migrations (incl. the appointment-KPI admin guard and the one-time opt-in
# prompt for existing parents, 2026-10-31), 2 edge
# functions, the frontend. The chat escalation fix is
# already live (chat_ai_rag_fixed v89), so it is not redeployed here.
#
# Run AFTER the prod secrets are set (step 0 below checks they exist):
#   BREVO_API_KEY, SUPPORT_FROM_EMAIL, SUPPORT_TEAM_EMAIL,
#   BREVO_WEBHOOK_SECRET (a NEW value, not staging's)
# BREVO_SMS_SENDER is optional: until Brevo approves the US Sender ID, texts are
# skipped and logged, email still goes out.
#
# The opt-in screen goes live with this release (client needs it public for the SMS
# Sender ID review): approved consent wording is applied, and .env must have
# VITE_CONSENT_STEP=true so the production build includes the screen.
# APP_URL is optional on prod: support-intake defaults to https://app.whisperoo.app.
#
# Order matters: migrations → functions → frontend. The frontend calls the new RPCs
# and support-intake, so it must not go out first. Each step stops on any mismatch.
source "$(dirname "$0")/_common.sh"

RELEASE_VERSIONS="20261003000001 20261003000002 20261021000001 20261031000001 20261031000002"
SB() { SUPABASE_ACCESS_TOKEN= "$HOME/scoop/shims/supabase.exe" "$@"; }

echo "== 0. preconditions =="
[ "$(git branch --show-current)" = "feature/get-support-intake" ] || { echo "STOP: release from feature/get-support-intake"; exit 1; }
git diff --quiet -- supabase src || { echo "STOP: uncommitted changes under supabase/ or src/"; exit 1; }
flyctl auth whoami >/dev/null || { echo "STOP: run flyctl auth login"; exit 1; }
SECRETS="$(SB secrets list --project-ref "$PROD_REF" 2>&1)"
for s in BREVO_API_KEY SUPPORT_FROM_EMAIL SUPPORT_TEAM_EMAIL BREVO_WEBHOOK_SECRET OPENAI_API_KEY; do
  echo "$SECRETS" | grep -qE "^\s*$s\s" || { echo "STOP: prod secret $s is not set"; exit 1; }
done
echo "secrets present"
grep -qE '^VITE_CONSENT_STEP=true\s*$' .env || { echo "STOP: set VITE_CONSENT_STEP=true in .env (opt-in screen ships with this release)"; exit 1; }

echo "== 1. backup =="
mkdir -p "$HOME/whisperoo-backups"
OUT="$HOME/whisperoo-backups/prod-public-$(date +%Y%m%d-%H%M%S)-pre-get-support.sql"
PGPASSWORD="$PROD_DB_PASSWORD" "$PGDUMP" -h "$POOLER" -p 5432 -U "postgres.$PROD_REF" -d postgres \
  --schema=public --no-owner --no-privileges -f "$OUT"
ls -la "$OUT"

echo "== 2. migrations =="
PENDING="$(pending_versions)"
printf '%s\n' "$PENDING"
diff <(printf '%s\n' "$PENDING") <(printf '%s\n' $RELEASE_VERSIONS | sort) >/dev/null \
  || { echo "STOP: prod pending set is not exactly the 5 release migrations"; exit 1; }
read -r -p "Apply these 5 migrations to PRODUCTION? Type PUSH: " ans
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
  prod_psql -1 -f "$WRAP" >/dev/null || { rm -f "$WRAP"; echo "STOP: $v failed and was rolled back"; exit 1; }
  rm -f "$WRAP"
done
prod_psql -f scripts/prod-push/10-verify.sql
echo "Expect: tracker=150, tables=2, video_col=1, rpcs=6, service_role_on_support_requests=true, anon_on_support_requests=false, kpi_anon_can_execute=false, kpi_has_admin_guard=true, consent_prompt_col=1, consent_prompt_fn=1"

echo "== 2b. approved consent wording =="
# Idempotent: skips versions already present, adds any new ones (en + es/vi).
prod_psql -1 -f scripts/prod-push/20-consent-go-live.sql

echo "== 3. functions =="
for fn in support-intake brevo-sms-webhook; do
  SB functions deploy "$fn" --project-ref "$PROD_REF" 2>&1 | grep -E "Deployed|status [0-9]{3}" \
    || { echo "STOP: $fn deploy produced no confirmation"; exit 1; }
done
URL="https://$PROD_REF.supabase.co/functions/v1"
echo -n "support-intake without auth (expect 401): "; curl -s -o /dev/null -w "%{http_code}\n" -X POST "$URL/support-intake" -d '{}'
echo -n "brevo-sms-webhook without secret (expect 401): "; curl -s -o /dev/null -w "%{http_code}\n" -X POST "$URL/brevo-sms-webhook" -d '{}'

echo "== 4. frontend =="
bash scripts/prod-push/04-frontend.sh
JS="$(curl -fsSL https://app.whisperoo.app/ | grep -o '/assets/index-[^"]*\.js' | head -1)"
B="$(mktemp)"; curl -fsSL "https://app.whisperoo.app$JS" -o "$B"
for p in support-intake fn_my_support_status fn_admin_list_support_requests expert_video_enabled 'VITE_CONSENT_STEP:"true"'; do
  grep -qF "$p" "$B" && echo "PASS  $p" || { echo "FAIL  $p"; FAILED=1; }
done
rm -f "$B"
[ "${FAILED:-0}" -eq 0 ] && echo "Release complete." || { echo "Bundle check FAILED — flyctl releases rollback -a whisperoo-app"; exit 1; }
