-- HIPAA Phase 1 Verification Queries
-- Run all of these in Supabase Studio → SQL Editor
-- Copy each section, run it, record the result

-- ─────────────────────────────────────────────────────────────
-- A1: Confirm views have security_invoker = on
-- ─────────────────────────────────────────────────────────────
SELECT
  relname AS view_name,
  (SELECT option_value
   FROM pg_options_to_table(reloptions)
   WHERE option_name = 'security_invoker') AS security_invoker
FROM pg_class
WHERE relname IN ('flagged_messages_view', 'admin_ai_audit_trail', 'tenant_user_details')
  AND relkind = 'v';
-- Expected: all 3 rows show security_invoker = 'on'

-- ─────────────────────────────────────────────────────────────
-- A1: Confirm consultation_bookings has RLS enabled
-- ─────────────────────────────────────────────────────────────
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'consultation_bookings';
-- Expected: rowsecurity = true

-- ─────────────────────────────────────────────────────────────
-- A1: Confirm "Users can view own bookings" policy exists
-- ─────────────────────────────────────────────────────────────
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'consultation_bookings';
-- Expected: includes "Users can view own bookings" with cmd = SELECT

-- ─────────────────────────────────────────────────────────────
-- A4: Confirm profiles.email column is gone
-- ─────────────────────────────────────────────────────────────
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'email';
-- Expected: 0 rows returned

-- ─────────────────────────────────────────────────────────────
-- B5: Confirm compliance_training has admin-only policies
-- ─────────────────────────────────────────────────────────────
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'compliance_training'
ORDER BY policyname;
-- Expected: NO policies named compliance_read_all / compliance_update_all / compliance_delete_all
-- Expected: policies named compliance_admin_read / compliance_admin_update / compliance_admin_delete

-- ─────────────────────────────────────────────────────────────
-- B5: Non-admin read check (run as a regular user session to confirm)
-- ─────────────────────────────────────────────────────────────
-- (Run this from a non-admin user's browser session, not SQL Editor which runs as postgres)
-- SELECT count(*) FROM compliance_training;
-- Expected: 0 rows (non-admin sees nothing)
