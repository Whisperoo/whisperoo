-- Capture the onboarding hospital-affiliation answer explicitly.
--
-- Problem this fixes:
--   "Independent" has never been a captured signal. OnboardingHospitalCheck.tsx's
--   "No, I'm independent" branch simply navigates onward and writes nothing, and the
--   Skip control writes nothing either. Everything downstream -- the Independent
--   Signups export, the B2C segment, fn_admin_independent_signups_export -- infers it
--   from `tenant_id IS NULL`.
--
--   That proxy silently merges three different populations:
--     1. people who explicitly answered "I am not a patient at any hospital"
--     2. people who skipped the question entirely
--     3. everyone who signed up before the hospital pilot existed, or during a
--        period with no active tenants (the question is not even shown then)
--
--   Reporting "independent signups" to a hospital client from that mixture
--   overstates it, and there is currently no way to tell the three apart.
--
-- Approach:
--   Record the answer itself, alongside when it was given. Deliberately a text
--   enum rather than a boolean, because "not affiliated" and "did not say" are
--   different facts and a boolean cannot hold both.
--
--   Existing rows stay NULL, which reads correctly as "never asked" -- it does not
--   claim they are independent. The proxy definition keeps working unchanged for
--   historical data; this only makes NEW signups precise.
--
-- Deliberately NOT changing fn_admin_independent_signups_export in this migration.
-- Switching it to the new column would immediately drop every pre-existing signup
-- out of the export, which is a reporting change the client should agree to, not a
-- side effect of adding a column. The column needs to accumulate real data first.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hospital_affiliation text,
  ADD COLUMN IF NOT EXISTS hospital_affiliation_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_hospital_affiliation_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_hospital_affiliation_check
      CHECK (hospital_affiliation IS NULL
             OR hospital_affiliation IN ('hospital', 'independent', 'skipped'));
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.hospital_affiliation IS
  'Answer given to the onboarding hospital question: hospital | independent | skipped. '
  'NULL means never asked (pre-pilot signup, or no active tenants at the time) -- it does '
  'NOT mean independent.';

COMMENT ON COLUMN public.profiles.hospital_affiliation_at IS
  'When the hospital-affiliation answer was recorded.';

-- ---------------------------------------------------------------------------
-- Setter RPC
--
-- SECURITY DEFINER for the same reason fn_link_user_to_hospital is: direct client
-- UPDATEs on profiles hit the RLS recursion this schema has had to work around
-- (see 20260507000003 / 20260507000012). Scoped to auth.uid() so a caller can only
-- ever write their own row, and validates the value rather than trusting the client.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_set_hospital_affiliation(p_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_value NOT IN ('hospital', 'independent', 'skipped') THEN
    RAISE EXCEPTION 'Invalid hospital_affiliation: %. Expected hospital, independent, or skipped.', p_value;
  END IF;

  UPDATE public.profiles
  SET hospital_affiliation    = p_value,
      hospital_affiliation_at = now()
  WHERE id = auth.uid();
END;
$$;

COMMENT ON FUNCTION public.fn_set_hospital_affiliation(text) IS
  'Records the caller''s onboarding hospital-affiliation answer. Scoped to auth.uid().';

GRANT EXECUTE ON FUNCTION public.fn_set_hospital_affiliation(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- ROLLBACK (manual)
--   DROP FUNCTION IF EXISTS public.fn_set_hospital_affiliation(text);
--   ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_hospital_affiliation_check;
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS hospital_affiliation_at;
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS hospital_affiliation;
-- ---------------------------------------------------------------------------
