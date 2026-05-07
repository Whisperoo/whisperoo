-- Migration: Hard reset profiles RLS policies to a non-recursive set
-- This addresses environments that accumulated conflicting policies and still throw 42P17 recursion.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.polname
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles;', r.polname);
  END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete_own"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- Super admin visibility/control for ops tooling
CREATE POLICY "Super admin can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('engineering@whisperoo.app', 'sharab.khan101010@gmail.com'));

CREATE POLICY "Super admin can insert profiles"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') IN ('engineering@whisperoo.app', 'sharab.khan101010@gmail.com'));

CREATE POLICY "Super admin can update all profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('engineering@whisperoo.app', 'sharab.khan101010@gmail.com'))
  WITH CHECK ((auth.jwt() ->> 'email') IN ('engineering@whisperoo.app', 'sharab.khan101010@gmail.com'));

CREATE POLICY "Super admin can delete profiles"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('engineering@whisperoo.app', 'sharab.khan101010@gmail.com'));

