-- Migration: Allow authenticated users to read visible expert profiles
-- Root cause: profiles RLS only allowed self-read + superadmin-read, so /experts returned 0 rows.

DROP POLICY IF EXISTS "Users can view visible experts" ON public.profiles;

CREATE POLICY "Users can view visible experts"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    account_type = 'expert'
    AND expert_verified = true
    AND COALESCE(expert_profile_visibility, true) = true
    AND COALESCE(expert_accepts_new_clients, true) = true
    AND COALESCE(expert_availability_status, 'available') <> 'unavailable'
  );

