#!/usr/bin/env bash
# Phase 1 — tracker rows only, runs no schema SQL. Marks the 42 migrations that were
# applied via the SQL Editor (verified read-only on 2026-09-12, see tasks/todo.md)
# as applied, so nothing replays them against live data.
#
# Equivalent of `supabase migration repair --status applied`, done over psql: one
# INSERT per version with the file's name and its content as the statements array.
source "$(dirname "$0")/_common.sh"

REPAIR="$(pending_versions | grep -vxF -f <(printf '%s\n' $NEW_VERSIONS) || true)"
COUNT="$(printf '%s\n' "$REPAIR" | grep -c . || true)"
echo "Versions to mark applied: $COUNT"
printf '%s\n' "$REPAIR"
[ "$COUNT" -eq 42 ] || { echo "STOP: expected 42, got $COUNT. Do not continue."; exit 1; }

SQL="$(mktemp --suffix=.sql)"
python - "$SQL" $REPAIR <<'PY'
import sys, glob, os
out, versions = sys.argv[1], sys.argv[2:]
lines = ["BEGIN;"]
for v in versions:
    path = glob.glob(f"supabase/migrations/{v}_*.sql")[0]
    name = os.path.basename(path)[15:-4]
    body = open(path, encoding="utf-8").read()
    assert "$repair$" not in body
    lines.append(
        "INSERT INTO supabase_migrations.schema_migrations(version, name, statements) "
        f"VALUES ('{v}', '{name}', ARRAY[$repair${body}$repair$]) ON CONFLICT (version) DO NOTHING;"
    )
lines.append("COMMIT;")
open(out, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print(f"generated {out} with {len(versions)} inserts")
PY

prod_psql -f "$SQL"
rm -f "$SQL"

echo "== pending after repair (must be exactly the 14 new) =="
PENDING="$(pending_versions)"
printf '%s\n' "$PENDING"
if diff <(printf '%s\n' "$PENDING") <(printf '%s\n' $NEW_VERSIONS | sort); then
  echo "OK: exactly the 14 expected migrations are pending."
else
  echo "STOP: pending set differs from the expected 14."
  exit 1
fi
