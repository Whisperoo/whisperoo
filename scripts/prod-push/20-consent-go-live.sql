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
--   1. The $legal$ … $legal$ blocks hold the exact approved text, verbatim. Links use
--      [label](https://whisperoo.app/...) — rendered as links by OnboardingConsent.
--   2. For SMS, the wording must include: sender (Whisperoo), purpose, frequency,
--      "Msg & data rates may apply", "Reply STOP to opt out, HELP for help".
--   3. Run: psql ... -v ON_ERROR_STOP=1 -1 -f scripts/prod-push/20-consent-go-live.sql
--      The guard below aborts if any block still contains the TODO marker.
-- =============================================================================

\set version_suffix '2026-11-v1'

CREATE TEMP TABLE new_consent (id text, channel text, locale text, body text) ON COMMIT DROP;

-- Approved by the client 2026-10-28 (English). es/vi to follow — until then the consent
-- screen falls back to English for Spanish/Vietnamese users (OnboardingConsent picks
-- the user's locale, else 'en'). Add es/vi rows here as a new version when approved.
INSERT INTO new_consent VALUES
  ('email-' || :'version_suffix' || '-en', 'email', 'en',
   $legal$Yes, email me updates about my support requests, plus helpful tips and resources from Whisperoo. You can unsubscribe at any time.$legal$),
  ('sms-'   || :'version_suffix' || '-en', 'sms',   'en',
   $legal$Yes, text me updates from Whisperoo about my support requests and account. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out or HELP for help. Consent is not a condition of using Whisperoo. See our [Terms](https://whisperoo.app/terms-and-conditions) and [Privacy Policy](https://whisperoo.app/privacy-policy).$legal$);

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
