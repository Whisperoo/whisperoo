-- =============================================================================
-- Consent go-live: replace the PLACEHOLDER consent copy with the client's final
-- legal wording. Run on staging first, then prod. Pair with turning the onboarding
-- consent screen on (VITE_CONSENT_STEP=true in .env, then scripts/fly-deploy.ps1).
--
-- Rules (from 20260912000005): consent_versions rows are NEVER edited after anyone
-- may have consented against them — add new versions and move `is_current`.
-- Exactly one current row per (channel, locale) is enforced by a unique index.
--
-- HOW TO USE
--   1. Paste the final wording into the six $legal$ … $legal$ blocks below (en/es/vi
--      for email and sms). Use the exact text legal approved, verbatim.
--   2. For SMS, the wording must include: sender (Whisperoo), purpose, frequency,
--      "Msg & data rates may apply", "Reply STOP to opt out, HELP for help".
--   3. Run: psql ... -v ON_ERROR_STOP=1 -1 -f scripts/prod-push/20-consent-go-live.sql
--      The guard below aborts if any block still contains the TODO marker.
-- =============================================================================

\set version_suffix '2026-11-v1'

CREATE TEMP TABLE new_consent (id text, channel text, locale text, body text) ON COMMIT DROP;

INSERT INTO new_consent VALUES
  ('email-' || :'version_suffix' || '-en', 'email', 'en', $legal$TODO: final English email consent text$legal$),
  ('email-' || :'version_suffix' || '-es', 'email', 'es', $legal$TODO: final Spanish email consent text$legal$),
  ('email-' || :'version_suffix' || '-vi', 'email', 'vi', $legal$TODO: final Vietnamese email consent text$legal$),
  ('sms-'   || :'version_suffix' || '-en', 'sms',   'en', $legal$TODO: final English SMS consent text$legal$),
  ('sms-'   || :'version_suffix' || '-es', 'sms',   'es', $legal$TODO: final Spanish SMS consent text$legal$),
  ('sms-'   || :'version_suffix' || '-vi', 'sms',   'vi', $legal$TODO: final Vietnamese SMS consent text$legal$);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM new_consent WHERE body ILIKE '%TODO%' OR body ILIKE '%PLACEHOLDER%' OR length(btrim(body)) < 40) THEN
    RAISE EXCEPTION 'Consent text still contains TODO/PLACEHOLDER or is suspiciously short — not applying';
  END IF;
  IF EXISTS (SELECT 1 FROM new_consent WHERE channel = 'sms' AND (body NOT ILIKE '%STOP%' OR body NOT ILIKE '%HELP%')) THEN
    RAISE EXCEPTION 'SMS consent text must mention STOP and HELP';
  END IF;
END $$;

-- Retire the current rows (placeholders included) for the channel/locales being replaced…
UPDATE public.consent_versions cv
   SET is_current = false
  FROM new_consent n
 WHERE cv.channel = n.channel AND cv.locale = n.locale AND cv.is_current;

-- …and add the new ones as current. Old rows stay, so past consents remain provable.
INSERT INTO public.consent_versions (id, channel, locale, body, is_current, effective_at)
SELECT id, channel, locale, body, true, now() FROM new_consent;

SELECT id, channel, locale, is_current, left(body, 60) AS starts_with
FROM public.consent_versions
ORDER BY channel, locale, is_current DESC, id;
