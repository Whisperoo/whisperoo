-- Migration: Align profiles admin policies with current super-admin allowlist
-- ======================================================
-- Problem:
-- - `20260507000012_reset_profiles_policies_no_recursion.sql` reintroduced
--   profiles admin policies gated only by engineering@whisperoo.app.
-- - This causes RLS failures for other approved super-admin operators.
--
-- Fix:
-- - Keep the non-recursive email-based policy pattern on profiles
-- - Expand the allowlist used by profiles SELECT/INSERT/UPDATE/DELETE policies

DROP POLICY IF EXISTS "Super admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can delete profiles" ON public.profiles;

CREATE POLICY "Super admin can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') IN ('engineering@whisperoo.app', 'sharab.khan101010@gmail.com')
  );

CREATE POLICY "Super admin can insert profiles"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'email') IN ('engineering@whisperoo.app', 'sharab.khan101010@gmail.com')
  );

CREATE POLICY "Super admin can update all profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') IN ('engineering@whisperoo.app', 'sharab.khan101010@gmail.com')
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') IN ('engineering@whisperoo.app', 'sharab.khan101010@gmail.com')
  );

CREATE POLICY "Super admin can delete profiles"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') IN ('engineering@whisperoo.app', 'sharab.khan101010@gmail.com')
  );

