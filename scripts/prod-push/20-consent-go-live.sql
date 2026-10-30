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

-- English approved by the client 2026-10-28. es/vi machine-translated with Google on
-- 2026-10-31 at the client's instruction (pending their bilingual review).
INSERT INTO new_consent VALUES
  ('email-' || :'version_suffix' || '-en', 'email', 'en',
   $legal$Yes, email me updates about my support requests, plus helpful tips and resources from Whisperoo. You can unsubscribe at any time.$legal$),
  ('sms-'   || :'version_suffix' || '-en', 'sms',   'en',
   $legal$Yes, text me updates from Whisperoo about my support requests and account. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out or HELP for help. Consent is not a condition of using Whisperoo. See our [Terms](https://whisperoo.app/terms-and-conditions) and [Privacy Policy](https://whisperoo.app/privacy-policy).$legal$),
  -- es/vi: Google-translated from the approved English (client-authorised 2026-10-31),
  -- STOP/HELP/Whisperoo/links protected. Back-translations: tasks/translation-check-2026-10-31.md
  ('email-' || :'version_suffix' || '-es', 'email', 'es',
   $legal$Sí, envíame actualizaciones por correo electrónico sobre mis solicitudes de soporte, además de consejos útiles y recursos de Whisperoo. Puedes darte de baja cuando quieras.$legal$),
  ('sms-'   || :'version_suffix' || '-es', 'sms',  'es',
   $legal$Sí, envíame actualizaciones por SMS desde Whisperoo sobre mis solicitudes de soporte y mi cuenta. La frecuencia de los mensajes varía. Pueden aplicarse tarifas de mensajes y datos. Responde STOP para darte de baja o HELP para obtener ayuda. El consentimiento no es una condición para usar Whisperoo. Consulta nuestros [Términos](https://whisperoo.app/terms-and-conditions) y [Política de Privacidad](https://whisperoo.app/privacy-policy).$legal$),
  ('email-' || :'version_suffix' || '-vi', 'email', 'vi',
   $legal$Vâng, hãy gửi email cho tôi các thông báo cập nhật về yêu cầu hỗ trợ của tôi, cùng với các mẹo và tài nguyên hữu ích từ Whisperoo. Bạn có thể hủy đăng ký bất cứ lúc nào.$legal$),
  ('sms-'   || :'version_suffix' || '-vi', 'sms',  'vi',
   $legal$Vâng, hãy gửi cho tôi tin nhắn cập nhật từ Whisperoo về các yêu cầu hỗ trợ và tài khoản của tôi. Tần suất tin nhắn có thể thay đổi. Cước phí tin nhắn và dữ liệu có thể được áp dụng. Trả lời STOP để hủy đăng ký hoặc HELP để được trợ giúp. Việc đồng ý không phải là điều kiện để sử dụng Whisperoo. Xem [Điều khoản](https://whisperoo.app/terms-and-conditions) và [Chính sách Quyền riêng tư](https://whisperoo.app/privacy-policy) của chúng tôi.$legal$);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM new_consent WHERE body ILIKE '%TODO%' OR body ILIKE '%PLACEHOLDER%' OR length(btrim(body)) < 40) THEN
    RAISE EXCEPTION 'Consent text still contains TODO/PLACEHOLDER or is suspiciously short — not applying';
  END IF;
  IF EXISTS (SELECT 1 FROM new_consent WHERE channel = 'sms' AND (body NOT ILIKE '%STOP%' OR body NOT ILIKE '%HELP%')) THEN
    RAISE EXCEPTION 'SMS consent text must mention STOP and HELP';
  END IF;
END $$;

-- Idempotent: versions already loaded are skipped, so re-running only adds what is new
-- (e.g. es/vi added after en went live). Rows are never edited once loaded.
DELETE FROM new_consent n USING public.consent_versions cv WHERE cv.id = n.id;

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
