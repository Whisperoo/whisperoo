-- =============================================================================
-- One-time messaging opt-in prompt for existing parents (client, 2026-10-31)
--
-- The opt-in screen only appears in onboarding, so every parent who signed up before
-- it went live could never opt in to email/SMS. The client wants them asked ONCE, the
-- next time they log in. consent_prompted_at records that the question was shown —
-- whatever they answered — so it never repeats.
--
-- New signups are marked when they pass the onboarding consent step. Parents who have
-- already recorded a choice are backfilled so they are never asked twice.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consent_prompted_at timestamptz;

COMMENT ON COLUMN public.profiles.consent_prompted_at IS
  'When the parent was shown the email/SMS opt-in (onboarding step or one-time login prompt). NULL = not yet asked.';

-- Anyone who already made a recorded choice has, by definition, been asked.
UPDATE public.profiles
   -- LEAST ignores NULLs: the earliest recorded consent decision.
   SET consent_prompted_at = LEAST(email_opt_in_at, sms_opt_in_at, email_opt_out_at, sms_opt_out_at)
 WHERE consent_prompted_at IS NULL
   AND COALESCE(email_opt_in_at, sms_opt_in_at, email_opt_out_at, sms_opt_out_at) IS NOT NULL;

-- The caller marks only their own row; first call wins, later calls change nothing.
CREATE OR REPLACE FUNCTION public.fn_mark_consent_prompted()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.profiles
     SET consent_prompted_at = now()
   WHERE id = auth.uid() AND consent_prompted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_mark_consent_prompted() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_mark_consent_prompted() TO authenticated;

-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.fn_mark_consent_prompted();
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS consent_prompted_at;
