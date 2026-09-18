#!/usr/bin/env bash
# Phase 2 — the schema push. Dry-run first; you type PUSH to run the real one.
# --include-all because 20250819000001 is older than versions already tracked.
source "$(dirname "$0")/_common.sh"
assert_linked_prod

echo "== dry run =="
supabase db push --dry-run --include-all

read -r -p "Dry run lists exactly the 14 migrations and nothing else? Type PUSH to continue: " ans
[ "$ans" = "PUSH" ] || { echo "aborted"; exit 1; }

supabase db push --include-all

echo "== verify =="
prod_psql -f scripts/prod-push/02-verify.sql
echo "Expect: tracker=145, new_rpcs=6, segment_rpcs=4, new_tables=3, profile_cols=3, idx=1, backfilled=completed, themes_restored=t"
