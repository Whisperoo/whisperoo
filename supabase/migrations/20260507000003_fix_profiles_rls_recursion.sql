-- Migration: Fix infinite recursion in profiles RLS
-- ============================================================
-- ROOT CAUSE:
-- The original catch-all "self_profile" policy uses USING + WITH CHECK
-- on ALL operations. When Supabase evaluates an UPDATE, it re-evaluates
-- the USING clause (to find the row for the update) which can trigger
-- a recursive SELECT on profiles — causing "infinite recursion detected
-- in policy for relation profiles".
--
-- FIX:
-- Drop the catch-all policy and replace with explicit, per-operation
-- policies that use (auth.uid() = id) directly, which Postgres resolves
-- from the JWT without querying the profiles table again.
-- ============================================================

-- Step 1: Drop the original catch-all policy
DROP POLICY IF EXISTS "self_profile" ON public.profiles;

-- Step 2: User can read their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Step 3: User can update their own profile
-- Note: No WITH CHECK needed — USING already restricts to own row,
-- and we do NOT want to block column updates (like tenant_id).
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Step 4: System/trigger can insert (profile is created by DB trigger on auth.users insert)
-- The trigger runs as SECURITY DEFINER so it bypasses RLS, but we add
-- this for completeness in case direct inserts are needed.
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Step 5: User can delete their own profile
CREATE POLICY "profiles_delete_own"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- NOTE: Super admin policies (from 20260502000002_admin_crud_policies.sql)
-- are preserved and unaffected. They use auth.jwt() ->> 'email' which
-- is resolved from the JWT token — no table scan, no recursion.
