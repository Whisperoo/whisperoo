# D1 — pgaudit enabled + verified

**Verified:** 2026-05-13 03:02-03:07 UTC

## Configuration

- Extension `pgaudit` enabled via Supabase Dashboard → Database → Extensions
- Role-level config: `ALTER ROLE postgres SET pgaudit.log = 'write, ddl';`
- Verified at `pg_roles`: `rolconfig` contains `pgaudit.log=write, ddl`

## Smoke-test evidence

Postgres logs (search `AUDIT:`, time range = Last hour) captured all 8 expected entries from the smoke-test sequence on `public.pgaudit_smoke_test`:

| Type | Operation | Object |
|---|---|---|
| DDL | CREATE TABLE | `public.pgaudit_smoke_test` |
| DDL | CREATE SEQUENCE | `public.pgaudit_smoke_test_id_seq` |
| DDL | ALTER SEQUENCE | `public.pgaudit_smoke_test_id_seq` |
| DDL | CREATE INDEX | `public.pgaudit_smoke_test_pkey` |
| WRITE | INSERT INTO | `public.pgaudit_smoke_test` |
| WRITE | UPDATE | `public.pgaudit_smoke_test` |
| WRITE | DELETE FROM | `public.pgaudit_smoke_test` |
| DDL | DROP TABLE | `public.pgaudit_smoke_test` (+ index) |

Total `AUDIT:` entries in the same hour: **45** — confirms production write activity is being audited continuously, not just the smoke test.

## Retention gap (post-pilot to-do)

- **Current retention:** Supabase Team plan ~30 days
- **HIPAA expectation:** ≥ 6 years for audit logs
- **Mitigation path:** set up **Supabase Log Drain** (Project Settings → Logs → Log Drains) to ship `postgres_logs` to S3 / Datadog / Logflare with long-term retention. Not blocking pilot launch, but required for full Stage 2 attestation.

Track follow-up: add to `tasks/todo.md` post-pilot backlog.

## Reproducibility

```sql
-- Verify config still in place
SELECT rolname, rolconfig
FROM pg_roles
WHERE rolname = 'postgres';
-- Expected: rolconfig array includes "pgaudit.log=write, ddl"

-- Verify logs are flowing
-- Supabase Dashboard → Logs & Analytics → Postgres → search "AUDIT:"
-- Should return entries continuously for any DB write or DDL action
```
