# Shared by the prod-push phases. Source, don't run.
# Phases 0–2 talk to prod over psql (the management-API token is refused on
# GET /v1/projects, so `supabase link` / `db push` are unavailable). Phases 3–4 use
# the CLI for functions and flyctl for the frontend.
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
# Two CLIs are installed: the npm wrapper (first on PATH, separate token store with the
# narrow PAT) and the scoop build, which holds the full login. Force the scoop one.
export PATH="$HOME/scoop/shims:$PATH"

prod_psql() {
  PGPASSWORD="$PROD_DB_PASSWORD" "$PSQL" -h "$POOLER" -p 5432 -U "postgres.$PROD_REF" -d postgres -v ON_ERROR_STOP=1 -At "$@"
}

# The 14 migrations that must be pending after the tracker repair — nothing else.
NEW_VERSIONS="20250819000001 20260822000001 20260827000001 20260831000001 20260831000002 20260909000001 20260912000001 20260912000002 20260912000003 20260912000004 20260912000005 20260912000006 20260914000001 20260914000002"

local_versions()  { ls supabase/migrations | cut -c1-14 | sort; }
# psql on Windows emits CRLF; strip the CR or comm never matches a line.
remote_versions() { prod_psql -c "select version from supabase_migrations.schema_migrations" | tr -d '\r' | sort; }
pending_versions() { comm -23 <(local_versions) <(remote_versions); }
