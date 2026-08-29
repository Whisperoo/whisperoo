-- ============================================================================
-- QA SEED CLEANUP -- STAGING ONLY. NEVER RUN AGAINST PRODUCTION.
--
--   Production ref: wznevejkaefokgibkknt   <-- never
--   Staging ref:    auttveumgltfedjptwfw   <-- this is the target
--
-- Removes everything created by scripts/qa/seed-staging-qa.sql and nothing else.
--
-- Safe by construction: every statement is scoped to the 'facade00-' UUID prefix
-- used exclusively by the seed. It cannot touch a real user or a real tenant,
-- because no genuine row carries that prefix. Deleting the auth.users rows
-- cascades to profiles (profiles.id references auth.users ON DELETE CASCADE),
-- but profiles are deleted explicitly first so the intent is visible rather
-- than implied.
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

DELETE FROM public.profiles WHERE id::text LIKE 'facade00-%';
DELETE FROM auth.users      WHERE id::text LIKE 'facade00-%';
DELETE FROM public.tenants  WHERE id::text LIKE 'facade00-%';

COMMIT;

-- Verification -- all three counts must be 0
SELECT 'profiles'   AS table_name, COUNT(*) AS remaining FROM public.profiles WHERE id::text LIKE 'facade00-%'
UNION ALL
SELECT 'auth.users', COUNT(*) FROM auth.users WHERE id::text LIKE 'facade00-%'
UNION ALL
SELECT 'tenants',    COUNT(*) FROM public.tenants WHERE id::text LIKE 'facade00-%'
ORDER BY 1;
