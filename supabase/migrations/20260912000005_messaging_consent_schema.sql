-- Messaging consent: schema only.
--
-- Sprint 2 (QUO-2026-004) workstream 3. The SendGrid / Twilio integration waits on
-- credentials from the client; the consent model does not, and the onboarding UI
-- that writes to it can be built and tested before a single message is sent.
--
-- What the quotation requires, and where each requirement lands:
--
--   "email_opt_in and sms_opt_in on the user record, each with timestamp, IP,
--    and the consent language version shown"
--        -> eight columns on profiles (four per channel)
--
--   "Exact displayed consent language logged by version ID at time of consent,
--    not just a boolean"
--        -> consent_versions table holds the verbatim copy per version;
--           profiles.*_consent_version references it, so the text a user
--           agreed to is always recoverable
--
--   "Two separate checkboxes, both unchecked by default"
--        -> both opt-in columns default false and are independent
--
--   "SMS consent is not a condition of product use"
--        -> nothing here is NOT NULL or CHECKed against onboarding state
--
--   "STOP handled inbound; opt-out written back immediately and suppressed
--    across all sequences, not per-campaign"
--        -> sms_opt_out_at is a single field on the profile, not a per-campaign
--           flag, so every future sequence reads one source of truth. The
--           inbound handler itself needs Twilio and is not in this migration.
--
-- Why a separate opt-OUT timestamp rather than flipping opt_in back to false:
-- TCPA disputes turn on "when did they consent and when did they revoke". Both
-- moments must survive. Flipping a boolean destroys the first.

-- ---------------------------------------------------------------------------
-- 1. Versioned consent copy
--
-- Legal will supply the wording. Each revision is a new row; rows are never
-- edited after a user has consented against them, because that would change
-- the record of what they agreed to. `channel` keeps email and SMS copy
-- separate -- the SMS text has mandated elements (sender identity, purpose,
-- frequency, "message and data rates may apply", STOP to opt out) that email
-- copy does not.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consent_versions (
  id           text        PRIMARY KEY,           -- e.g. 'sms-2026-09-v1'
  channel      text        NOT NULL CHECK (channel IN ('email', 'sms')),
  locale       text        NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'es', 'vi')),
  body         text        NOT NULL,              -- the exact text shown, verbatim
  is_current   boolean     NOT NULL DEFAULT false,
  effective_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.consent_versions IS
  'Verbatim consent copy by version. Never edit a row a user has consented against; add a new version.';

-- Exactly one current version per channel+locale, so the onboarding UI has an
-- unambiguous answer to "which text do I show right now".
CREATE UNIQUE INDEX IF NOT EXISTS uq_consent_versions_current
  ON public.consent_versions (channel, locale)
  WHERE is_current;

ALTER TABLE public.consent_versions ENABLE ROW LEVEL SECURITY;

-- Anyone signed in may read: the onboarding screen has to fetch the copy.
DROP POLICY IF EXISTS "Authenticated users read consent versions" ON public.consent_versions;
CREATE POLICY "Authenticated users read consent versions"
  ON public.consent_versions FOR SELECT TO authenticated USING (true);

-- Only staff admins manage versions.
DROP POLICY IF EXISTS "Admins manage consent versions" ON public.consent_versions;
CREATE POLICY "Admins manage consent versions"
  ON public.consent_versions FOR ALL
  USING (fn_caller_is_staff_admin())
  WITH CHECK (fn_caller_is_staff_admin());

GRANT SELECT ON public.consent_versions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.consent_versions TO authenticated;  -- RLS gates to admins
GRANT ALL ON public.consent_versions TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Consent state on the user record
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_opt_in          boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_opt_in_at       timestamptz,
  ADD COLUMN IF NOT EXISTS email_opt_in_ip       inet,
  ADD COLUMN IF NOT EXISTS email_consent_version text REFERENCES public.consent_versions(id),
  ADD COLUMN IF NOT EXISTS email_opt_out_at      timestamptz,

  ADD COLUMN IF NOT EXISTS sms_opt_in            boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_opt_in_at         timestamptz,
  ADD COLUMN IF NOT EXISTS sms_opt_in_ip         inet,
  ADD COLUMN IF NOT EXISTS sms_consent_version   text REFERENCES public.consent_versions(id),
  ADD COLUMN IF NOT EXISTS sms_opt_out_at        timestamptz;

COMMENT ON COLUMN public.profiles.sms_opt_out_at IS
  'Set by inbound STOP (or an admin). One field, not per-campaign: every sequence must check it. Opt-in history is preserved alongside for TCPA.';
COMMENT ON COLUMN public.profiles.email_consent_version IS
  'consent_versions.id the user agreed to. Joins back to the exact wording they saw.';

-- ---------------------------------------------------------------------------
-- 3. Setter RPC
--
-- SECURITY DEFINER for the same reason every other profile write here is: direct
-- client UPDATEs on profiles hit the RLS recursion worked around in
-- 20260507000003 / 20260507000012. Scoped to auth.uid(); a caller can only
-- record consent for themselves.
--
-- The IP is taken from the request headers server-side, NOT passed in by the
-- client -- a self-reported IP is worthless as evidence.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_record_messaging_consent(
  p_channel text,
  p_opt_in  boolean,
  p_version text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip   inet;
  v_hdrs jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_channel NOT IN ('email', 'sms') THEN
    RAISE EXCEPTION 'Invalid channel: %. Expected email or sms.', p_channel;
  END IF;
  IF p_opt_in AND (p_version IS NULL OR NOT EXISTS (SELECT 1 FROM public.consent_versions cv WHERE cv.id = p_version AND cv.channel = p_channel)) THEN
    RAISE EXCEPTION 'Opt-in requires a valid consent version for channel %', p_channel;
  END IF;

  -- PostgREST forwards request headers; x-forwarded-for carries the client IP.
  BEGIN
    v_hdrs := current_setting('request.headers', true)::jsonb;
    v_ip := NULLIF(split_part(COALESCE(v_hdrs->>'x-forwarded-for', ''), ',', 1), '')::inet;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  IF p_channel = 'email' THEN
    UPDATE public.profiles SET
      email_opt_in          = p_opt_in,
      email_opt_in_at       = CASE WHEN p_opt_in THEN now() ELSE email_opt_in_at END,
      email_opt_in_ip       = CASE WHEN p_opt_in THEN v_ip  ELSE email_opt_in_ip END,
      email_consent_version = CASE WHEN p_opt_in THEN p_version ELSE email_consent_version END,
      email_opt_out_at      = CASE WHEN p_opt_in THEN NULL ELSE now() END
    WHERE id = auth.uid();
  ELSE
    UPDATE public.profiles SET
      sms_opt_in            = p_opt_in,
      sms_opt_in_at         = CASE WHEN p_opt_in THEN now() ELSE sms_opt_in_at END,
      sms_opt_in_ip         = CASE WHEN p_opt_in THEN v_ip  ELSE sms_opt_in_ip END,
      sms_consent_version   = CASE WHEN p_opt_in THEN p_version ELSE sms_consent_version END,
      sms_opt_out_at        = CASE WHEN p_opt_in THEN NULL ELSE now() END
    WHERE id = auth.uid();
  END IF;
END;
$$;

COMMENT ON FUNCTION public.fn_record_messaging_consent(text, boolean, text) IS
  'Records the caller''s email/SMS consent decision with timestamp, server-observed IP and consent version. Scoped to auth.uid().';

GRANT EXECUTE ON FUNCTION public.fn_record_messaging_consent(text, boolean, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Placeholder copy so the onboarding UI can be built and tested now.
--    Marked as such; legal's final wording replaces these as new versions.
-- ---------------------------------------------------------------------------
INSERT INTO public.consent_versions (id, channel, locale, body, is_current) VALUES
  ('email-2026-09-draft', 'email', 'en',
   'PLACEHOLDER — pending legal. I agree to receive helpful emails from Whisperoo about my family''s care. I can unsubscribe at any time.',
   true),
  ('sms-2026-09-draft', 'sms', 'en',
   'PLACEHOLDER — pending legal. I agree to receive text messages from Whisperoo about my family''s care, up to 4 per month. Message and data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of using Whisperoo. See our Terms and Privacy Policy.',
   true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- ROLLBACK (manual)
--   DROP FUNCTION IF EXISTS public.fn_record_messaging_consent(text, boolean, text);
--   ALTER TABLE public.profiles
--     DROP COLUMN IF EXISTS sms_opt_out_at, DROP COLUMN IF EXISTS sms_consent_version,
--     DROP COLUMN IF EXISTS sms_opt_in_ip, DROP COLUMN IF EXISTS sms_opt_in_at,
--     DROP COLUMN IF EXISTS sms_opt_in, DROP COLUMN IF EXISTS email_opt_out_at,
--     DROP COLUMN IF EXISTS email_consent_version, DROP COLUMN IF EXISTS email_opt_in_ip,
--     DROP COLUMN IF EXISTS email_opt_in_at, DROP COLUMN IF EXISTS email_opt_in;
--   DROP TABLE IF EXISTS public.consent_versions;
-- ---------------------------------------------------------------------------
