-- Phase 2 / B7 Verification Queries
-- Run in Supabase Studio → SQL Editor after applying 20260513000001_phase2_b7_account_type_admin_gate.sql

-- ─────────────────────────────────────────────────────────────
-- 1) Confirm fn_caller_is_staff_admin() helper exists
-- ─────────────────────────────────────────────────────────────
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'fn_caller_is_staff_admin';
-- Expected: 1 row, security_type = 'DEFINER'

-- ─────────────────────────────────────────────────────────────
-- 2) Confirm profiles admin policies no longer reference JWT email
-- ─────────────────────────────────────────────────────────────
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles'
  AND policyname ILIKE '%admin%'
ORDER BY policyname;
-- Expected: policies use fn_caller_is_staff_admin(), NOT auth.jwt()->>'email'

-- ─────────────────────────────────────────────────────────────
-- 3) Confirm discount_codes, products, tenants policies updated
-- ─────────────────────────────────────────────────────────────
SELECT tablename, policyname, qual
FROM pg_policies
WHERE tablename IN ('discount_codes', 'products', 'tenants')
  AND policyname ILIKE '%admin%'
ORDER BY tablename, policyname;
-- Expected: all reference fn_caller_is_staff_admin()

-- ─────────────────────────────────────────────────────────────
-- 4) Confirm storage admin policies updated for expert-images
-- ─────────────────────────────────────────────────────────────
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname ILIKE '%expert image%';
-- Expected: qual / with_check reference fn_caller_is_staff_admin()

-- ─────────────────────────────────────────────────────────────
-- 5) Confirm no remaining JWT email allowlist in live policies
-- ─────────────────────────────────────────────────────────────
SELECT tablename, policyname, qual
FROM pg_policies
WHERE qual ILIKE '%engineering@whisperoo%'
   OR qual ILIKE '%sharab.khan%';
-- Expected: 0 rows

-- ─────────────────────────────────────────────────────────────
-- 6) Functional test — call fn_caller_is_staff_admin()
--    (run as a super_admin user session, not postgres)
-- ─────────────────────────────────────────────────────────────
-- SELECT public.fn_caller_is_staff_admin();
-- Expected: true (when called from a super_admin session)
-- Expected: false (when called from a regular parent session)
