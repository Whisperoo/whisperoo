-- ============================================================================
-- QA SEED DATA -- STAGING ONLY. NEVER RUN AGAINST PRODUCTION.
--
--   Production ref: wznevejkaefokgibkknt   <-- never
--   Staging ref:    auttveumgltfedjptwfw   <-- this is the target
--
-- Purpose: give the admin metrics dashboard enough data that the
-- All / Hospital / B2C segment selector visibly changes the numbers. Without
-- this every metric reads 0 and all three segments look identical, so the
-- selector appears broken when it is actually working correctly.
--
-- What it creates (all obviously fake, all UUIDs prefixed 'facade00-'):
--   1 tenant  : "QA Test Hospital" (slug qa-test-hospital)
--   6 profiles: tenant-affiliated  -> counted under 'all' and 'hospital'
--   4 profiles: no tenant          -> counted under 'all' and 'b2c'
--
-- Expected "Total Enrolled":  All = 10,  Hospital = 6,  B2C = 4.
--
-- Every profile needs a matching auth.users row (profiles.id references it).
-- These are inert rows -- no password set, so none of them can actually log in.
--
-- Idempotent: re-running changes nothing (ON CONFLICT DO NOTHING).
-- Undo with scripts/qa/cleanup-staging-qa.sql.
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------------
-- Safety guard (heuristic, not a guarantee)
--
-- There is no way to read the Supabase project ref from inside SQL, so this
-- checks something correlated instead: production has real users, staging is a
-- schema-only replica. If many non-QA profiles exist, assume this is the wrong
-- database and abort before writing anything.
--
-- ALWAYS also confirm the connection target yourself before running.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_real_profiles int;
BEGIN
  SELECT COUNT(*) INTO v_real_profiles
  FROM public.profiles
  WHERE id::text NOT LIKE 'facade00-%';

  IF v_real_profiles > 50 THEN
    RAISE EXCEPTION
      'ABORTED: found % non-QA profiles. This looks like a real database, not staging. Refusing to seed.',
      v_real_profiles;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Test tenant
-- ---------------------------------------------------------------------------
INSERT INTO public.tenants (id, slug, name, is_active)
VALUES ('facade00-0000-4000-8000-000000000001', 'qa-test-hospital', 'QA Test Hospital', true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. auth.users rows (FK target for profiles). No password -> cannot sign in.
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email, aud, role)
SELECT u.id, u.email, 'authenticated', 'authenticated'
FROM (VALUES
  ('facade00-0000-4000-8000-000000000011'::uuid, 'qa.hospital.1@qa.invalid'),
  ('facade00-0000-4000-8000-000000000012'::uuid, 'qa.hospital.2@qa.invalid'),
  ('facade00-0000-4000-8000-000000000013'::uuid, 'qa.hospital.3@qa.invalid'),
  ('facade00-0000-4000-8000-000000000014'::uuid, 'qa.hospital.4@qa.invalid'),
  ('facade00-0000-4000-8000-000000000015'::uuid, 'qa.hospital.5@qa.invalid'),
  ('facade00-0000-4000-8000-000000000016'::uuid, 'qa.hospital.6@qa.invalid'),
  ('facade00-0000-4000-8000-000000000021'::uuid, 'qa.b2c.1@qa.invalid'),
  ('facade00-0000-4000-8000-000000000022'::uuid, 'qa.b2c.2@qa.invalid'),
  ('facade00-0000-4000-8000-000000000023'::uuid, 'qa.b2c.3@qa.invalid'),
  ('facade00-0000-4000-8000-000000000024'::uuid, 'qa.b2c.4@qa.invalid')
) AS u(id, email)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Hospital-affiliated profiles (tenant_id set) -> 'all' + 'hospital'
--    Spread across the last 30 days so the default date filter includes them.
-- ---------------------------------------------------------------------------
INSERT INTO public.profiles
  (id, first_name, account_type, onboarded, tenant_id, acquisition_source, acquisition_department, created_at)
SELECT p.id, p.first_name, 'user', true,
       'facade00-0000-4000-8000-000000000001'::uuid,
       p.src, p.dept, now() - (p.days || ' days')::interval
FROM (VALUES
  ('facade00-0000-4000-8000-000000000011'::uuid, 'QA Hospital One',   'qr_ob', 'OB/GYN',    2),
  ('facade00-0000-4000-8000-000000000012'::uuid, 'QA Hospital Two',   'qr_ob', 'OB/GYN',    5),
  ('facade00-0000-4000-8000-000000000013'::uuid, 'QA Hospital Three', 'qr_er', 'Emergency', 9),
  ('facade00-0000-4000-8000-000000000014'::uuid, 'QA Hospital Four',  'qr_er', 'Emergency', 14),
  ('facade00-0000-4000-8000-000000000015'::uuid, 'QA Hospital Five',  'organic', NULL,      20),
  ('facade00-0000-4000-8000-000000000016'::uuid, 'QA Hospital Six',   'organic', NULL,      27)
) AS p(id, first_name, src, dept, days)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Unaffiliated / B2C profiles (tenant_id NULL) -> 'all' + 'b2c'
-- ---------------------------------------------------------------------------
INSERT INTO public.profiles
  (id, first_name, account_type, onboarded, tenant_id, acquisition_source, created_at)
SELECT p.id, p.first_name, 'user', true, NULL, 'organic', now() - (p.days || ' days')::interval
FROM (VALUES
  ('facade00-0000-4000-8000-000000000021'::uuid, 'QA Direct One',   3),
  ('facade00-0000-4000-8000-000000000022'::uuid, 'QA Direct Two',   8),
  ('facade00-0000-4000-8000-000000000023'::uuid, 'QA Direct Three', 16),
  ('facade00-0000-4000-8000-000000000024'::uuid, 'QA Direct Four',  25)
) AS p(id, first_name, days)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification -- these are the numbers the dashboard should show
-- ---------------------------------------------------------------------------
SELECT 'all'      AS segment, COUNT(*) AS onboarded_profiles FROM public.profiles WHERE onboarded
UNION ALL
SELECT 'hospital', COUNT(*) FROM public.profiles WHERE onboarded AND tenant_id IS NOT NULL
UNION ALL
SELECT 'b2c',      COUNT(*) FROM public.profiles WHERE onboarded AND tenant_id IS NULL
ORDER BY 1;
