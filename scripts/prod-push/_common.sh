# Shared by the prod-push phases. Source, don't run.
# Every phase re-asserts the prod ref because this working copy has been linked to
# STAGING for weeks and the CLI silently targets whatever supabase/.temp says.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

PROD_REF="wznevejkaefokgibkknt"
STAGING_REF="auttveumgltfedjptwfw"
PSQL="$HOME/scoop/apps/postgresql/current/bin/psql"
PGDUMP="$HOME/scoop/apps/postgresql/current/bin/pg_dump"
POOLER="aws-0-us-east-2.pooler.supabase.com"

# .env = PRODUCTION. Only SUPABASE_DB_PASSWORD is read from it; nothing is printed.
PROD_DB_PASSWORD="$(grep -E '^SUPABASE_DB_PASSWORD=' .env | cut -d= -f2- | tr -d '\r"')"
[ -n "$PROD_DB_PASSWORD" ] || { echo "SUPABASE_DB_PASSWORD missing from .env"; exit 1; }

# The narrow PAT in .env.staging 403s on prod; the keyring login must be used.
unset SUPABASE_ACCESS_TOKEN

prod_psql() {
  PGPASSWORD="$PROD_DB_PASSWORD" "$PSQL" -h "$POOLER" -p 5432 -U "postgres.$PROD_REF" -d postgres -v ON_ERROR_STOP=1 -At "$@"
}

assert_linked_prod() {
  local ref
  ref="$(cat supabase/.temp/project-ref 2>/dev/null || true)"
  [ "$ref" = "$PROD_REF" ] || { echo "STOP: CLI is linked to '$ref', not prod. Run 00-preflight.sh first."; exit 1; }
}

# The 14 migrations that must be pending after the tracker repair — nothing else.
NEW_VERSIONS="20250819000001 20260822000001 20260827000001 20260831000001 20260831000002 20260909000001 20260912000001 20260912000002 20260912000003 20260912000004 20260912000005 20260912000006 20260914000001 20260914000002"

local_versions()  { ls supabase/migrations | cut -c1-14 | sort; }
remote_versions() { prod_psql -c "select version from supabase_migrations.schema_migrations" | sort; }
pending_versions() { comm -23 <(local_versions) <(remote_versions); }
