-- Backfill account_type = 'super_admin' for the engineering@whisperoo.app
-- staff user.
--
-- Migration 20260513000001 replaced the email-based super-admin gate with
-- a profiles.account_type check (via fn_caller_is_staff_admin), but didn't
-- set that column for the existing staff user. As a result, Login.tsx reads
-- account_type IS NULL and routes them to /dashboard instead of /admin/super.
--
-- This is a one-row, idempotent UPDATE: only writes when the column is
-- missing the staff value, so re-running it is safe.

BEGIN;

UPDATE public.profiles p
SET account_type = 'super_admin'
FROM auth.users u
WHERE u.id = p.id
  AND lower(u.email) = 'engineering@whisperoo.app'
  AND (p.account_type IS NULL
       OR p.account_type NOT IN ('admin', 'super_admin', 'superadmin'));

COMMIT;
