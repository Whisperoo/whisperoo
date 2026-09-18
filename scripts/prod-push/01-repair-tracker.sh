#!/usr/bin/env bash
# Phase 1 — tracker rows only, runs no schema SQL. Marks the 42 migrations that were
# applied via the SQL Editor (verified read-only on 2026-09-12, see tasks/todo.md)
# as applied, so `db push` will not replay them against live data.
source "$(dirname "$0")/_common.sh"
assert_linked_prod

REPAIR="$(pending_versions | grep -vxF -f <(printf '%s\n' $NEW_VERSIONS) || true)"
COUNT="$(printf '%s\n' "$REPAIR" | grep -c . || true)"
echo "Versions to mark applied: $COUNT"
printf '%s\n' "$REPAIR"
[ "$COUNT" -eq 42 ] || { echo "STOP: expected 42, got $COUNT. Do not continue."; exit 1; }

# shellcheck disable=SC2086
supabase migration repair --status applied $REPAIR

echo "== pending after repair (must be exactly the 14 new) =="
PENDING="$(pending_versions)"
printf '%s\n' "$PENDING"
if diff <(printf '%s\n' "$PENDING") <(printf '%s\n' $NEW_VERSIONS | sort); then
  echo "OK: exactly the 14 expected migrations are pending."
else
  echo "STOP: pending set differs from the expected 14."
  exit 1
fi
