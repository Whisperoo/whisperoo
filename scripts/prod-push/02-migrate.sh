#!/usr/bin/env bash
# Phase 2 — the schema push, over psql. Each of the 14 files runs in ONE transaction
# together with its tracker INSERT (exactly how `supabase db push` applies a file),
# so a failing file leaves neither schema change nor tracker row behind. Stops at
# the first failure.
source "$(dirname "$0")/_common.sh"

echo "== pending (must be exactly the 14 new, in this order) =="
PENDING="$(pending_versions)"
printf '%s\n' "$PENDING"
diff <(printf '%s\n' "$PENDING") <(printf '%s\n' $NEW_VERSIONS | sort) >/dev/null \
  || { echo "STOP: pending set is not the expected 14. Run 01 first."; exit 1; }

read -r -p "Apply these 14 migrations to PRODUCTION now? Type PUSH to continue: " ans
[ "$ans" = "PUSH" ] || { echo "aborted"; exit 1; }

for v in $NEW_VERSIONS; do
  FILE="$(ls supabase/migrations/${v}_*.sql)"
  NAME="$(basename "$FILE" .sql | cut -c16-)"
  echo "--- applying $v $NAME"
  WRAP="$(mktemp --suffix=.sql)"
  python - "$FILE" "$v" "$NAME" "$WRAP" <<'PY'
import sys
src, v, name, out = sys.argv[1:5]
body = open(src, encoding="utf-8").read()
assert "$mig$" not in body
open(out, "w", encoding="utf-8").write(
    body + "\n\nINSERT INTO supabase_migrations.schema_migrations(version, name, statements) "
    f"VALUES ('{v}', '{name}', ARRAY[$mig${body}$mig$]) ON CONFLICT (version) DO NOTHING;\n"
)
PY
  # -1: the file's DDL and its tracker row commit together or not at all.
  prod_psql -1 -f "$WRAP" \
    || { rm -f "$WRAP"; echo "STOP: $v failed and was rolled back. Nothing after it was applied."; exit 1; }
  rm -f "$WRAP"
done

echo "== verify =="
prod_psql -f scripts/prod-push/02-verify.sql
echo "Expect: tracker=145, new_rpcs=6, segment_rpcs=4, new_tables=3, profile_cols=3, idx=1, backfilled=completed, themes_restored=true"
