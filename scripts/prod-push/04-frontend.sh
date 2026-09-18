#!/usr/bin/env bash
# Phase 4 — frontend to Fly (whisperoo-app) via the PRODUCTION deploy script, then a
# presence + absence audit of the bundle actually being served.
source "$(dirname "$0")/_common.sh"

powershell -NoProfile -ExecutionPolicy Bypass -File scripts/fly-deploy.ps1

echo "== bundle audit =="
JS="$(curl -fsSL https://app.whisperoo.app/ | grep -o '/assets/index-[^"]*\.js' | head -1)"
[ -n "$JS" ] || { echo "FAIL: could not find bundle path"; exit 1; }
B="$(mktemp)"; curl -fsSL "https://app.whisperoo.app$JS" -o "$B"
FAILED=0
pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; FAILED=1; }
grep -q  "$PROD_REF"                        "$B" && pass "prod supabase ref present"      || fail "prod ref missing"
grep -q  "$STAGING_REF"                     "$B" && fail "STAGING ref present"            || pass "no staging ref"
grep -qE 'pk_live_[A-Za-z0-9]{20,}'         "$B" && pass "pk_live_ key present"           || fail "pk_live_ key missing"
grep -qE 'pk_test_[A-Za-z0-9]{20,}'         "$B" && fail "pk_test_ key present"           || pass "no pk_test_ key"
grep -qE 'sk_(live|test)_'                  "$B" && fail "secret key in bundle"           || pass "no secret key"
grep -q  'https://whisperoo.app'            "$B" && pass "prod landing URL present"       || fail "landing URL missing"
grep -q  'fn_get_admin_funnel'              "$B" && pass "funnel RPC present"             || fail "funnel RPC missing"
grep -q  'fn_admin_user_timeline'           "$B" && pass "user timeline RPC present"      || fail "timeline RPC missing"
grep -q  'pub-30038c738c3e4d149ab4b5eb1b633592' "$B" && fail "STAGING R2 URL present"    || pass "no staging R2 URL"
rm -f "$B"
if [ "$FAILED" -eq 0 ]; then
  echo "Bundle audit passed."
else
  echo "Bundle audit FAILED — roll back now: flyctl releases rollback -a whisperoo-app"
  exit 1
fi
