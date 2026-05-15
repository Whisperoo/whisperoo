-- Fix: Expert availability/visibility flags in RLS break product card joins.
--
-- The "Users can view visible experts" policy filtered on expert_availability_status,
-- expert_profile_visibility, and expert_accepts_new_clients. When any of these was
-- set to hide/unavailable the profiles join in the products query returned null,
-- causing product cards to show "Expert" instead of the real expert name.
--
-- ExpertProfiles.tsx already applies these filters in its application-layer query.
-- RLS should only gate on security-relevant criteria (account_type, expert_verified).

DROP POLICY IF EXISTS "Users can view visible experts" ON public.profiles;

CREATE POLICY "Users can view visible experts"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    account_type = 'expert'
    AND expert_verified = true
  );
