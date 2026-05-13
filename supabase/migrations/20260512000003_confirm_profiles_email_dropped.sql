-- 20260512000003_confirm_profiles_email_dropped.sql
-- HIPAA A4: Sentinel migration confirming profiles.email column is dropped.
--
-- The column was intended to be dropped by 20260504000001_hipaa_remove_email.sql,
-- but production drift meant the column persisted with 2 stale rows.
-- Before applying this migration, manually run in the SQL Editor:
--
--   1. SELECT id, email FROM profiles WHERE email IS NOT NULL;
--   2. UPDATE profiles SET email = NULL WHERE email IS NOT NULL;
--   3. Confirm: SELECT COUNT(*) FROM profiles WHERE email IS NOT NULL; -- must be 0
--
-- This migration then drops the column definitively (IF EXISTS is safe if already gone).

ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- Verification:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'profiles'
--   AND column_name = 'email';
-- Must return 0 rows.
