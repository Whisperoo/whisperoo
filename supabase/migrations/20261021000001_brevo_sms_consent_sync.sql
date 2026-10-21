-- =============================================================================
-- Brevo SMS STOP / START → our consent record (2026-10-21)
--
-- Brevo handles the STOP/START/HELP keywords itself and blocklists the number.
-- Without this, our own record (profiles.sms_opt_in / sms_opt_out_at, the "single
-- source of truth" from 20260912000005) would never learn about it. The
-- `brevo-sms-webhook` edge function receives Brevo's Subscribe / Unsubscribe
-- events and calls fn_service_apply_sms_keyword below.
--
-- Semantics match fn_record_messaging_consent:
--   STOP  → sms_opt_in = false, sms_opt_out_at = now(); the original consent
--           (time, IP, version) is kept — TCPA disputes need both moments.
--   START → restores SMS ONLY for a parent who previously consented in the app
--           (sms_consent_version set). It never creates consent from nothing.
--
-- sms_consent_events is append-only: repeated STOP/START would otherwise overwrite
-- the single sms_opt_out_at and lose history.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sms_consent_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  event         text        NOT NULL CHECK (event IN ('opt_out', 'opt_in', 'opt_in_ignored')),
  source        text        NOT NULL DEFAULT 'brevo',
  phone_last4   text,       -- enough to investigate a dispute without storing the number twice
  provider_ref  text,       -- Brevo messageId / reference, when present
  received_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sms_consent_events IS
  'Append-only log of inbound SMS keyword consent changes (STOP/START) from the SMS provider.';

CREATE INDEX IF NOT EXISTS idx_sms_consent_events_user ON public.sms_consent_events (user_id, received_at DESC);

ALTER TABLE public.sms_consent_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sms_consent_events_select_staff ON public.sms_consent_events;
CREATE POLICY sms_consent_events_select_staff ON public.sms_consent_events
  FOR SELECT TO authenticated
  USING (public.fn_caller_is_staff_admin());

-- Explicit end state (prod's default privileges differ from staging's).
REVOKE ALL ON public.sms_consent_events FROM anon, authenticated;
GRANT SELECT ON public.sms_consent_events TO authenticated;
GRANT ALL ON public.sms_consent_events TO service_role;

-- Append-only: no updates or deletes, even by the service role. One exception:
-- user_id ON DELETE SET NULL is itself an UPDATE, and blocking it would make
-- deleting a parent's account fail. Clearing user_id (and changing nothing else)
-- is allowed; the event row survives, de-linked.
CREATE OR REPLACE FUNCTION public.fn_sms_consent_events_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.user_id IS NOT NULL AND NEW.user_id IS NULL
     AND (NEW.id, NEW.event, NEW.source, NEW.phone_last4, NEW.provider_ref, NEW.received_at)
         IS NOT DISTINCT FROM
         (OLD.id, OLD.event, OLD.source, OLD.phone_last4, OLD.provider_ref, OLD.received_at)
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'sms_consent_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_consent_events_immutable ON public.sms_consent_events;
CREATE TRIGGER trg_sms_consent_events_immutable
  BEFORE UPDATE OR DELETE ON public.sms_consent_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_sms_consent_events_immutable();


-- -----------------------------------------------------------------------------
-- Apply one keyword event to every profile with that phone number.
-- p_phone: as Brevo sends it — digits with country code, e.g. '12018570057'.
-- Profiles store US numbers as '(201) 857-0057'; both sides are compared as the
-- 10-digit national number. Non-US / malformed input matches nothing.
-- Returns the number of profiles changed.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_service_apply_sms_keyword(
  p_phone        text,
  p_event        text,          -- 'opt_out' | 'opt_in'
  p_provider_ref text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits  text := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  v_count   integer := 0;
  r         record;
BEGIN
  IF p_event NOT IN ('opt_out', 'opt_in') THEN
    RAISE EXCEPTION 'Invalid event %', p_event;
  END IF;

  IF length(v_digits) = 11 AND left(v_digits, 1) = '1' THEN
    v_digits := right(v_digits, 10);
  END IF;
  IF length(v_digits) <> 10 THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT p.id, p.sms_consent_version
    FROM public.profiles p
    WHERE regexp_replace(COALESCE(p.phone_number, ''), '\D', '', 'g') IN (v_digits, '1' || v_digits)
  LOOP
    IF p_event = 'opt_out' THEN
      UPDATE public.profiles
         SET sms_opt_in = false, sms_opt_out_at = now()
       WHERE id = r.id;
      INSERT INTO public.sms_consent_events (user_id, event, phone_last4, provider_ref)
      VALUES (r.id, 'opt_out', right(v_digits, 4), p_provider_ref);
      v_count := v_count + 1;
    ELSIF r.sms_consent_version IS NOT NULL THEN
      UPDATE public.profiles
         SET sms_opt_in = true, sms_opt_out_at = NULL
       WHERE id = r.id;
      INSERT INTO public.sms_consent_events (user_id, event, phone_last4, provider_ref)
      VALUES (r.id, 'opt_in', right(v_digits, 4), p_provider_ref);
      v_count := v_count + 1;
    ELSE
      -- START from someone who never consented in the app: record it, change nothing.
      INSERT INTO public.sms_consent_events (user_id, event, phone_last4, provider_ref)
      VALUES (r.id, 'opt_in_ignored', right(v_digits, 4), p_provider_ref);
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_service_apply_sms_keyword(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_service_apply_sms_keyword(text, text, text) TO service_role;

-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.fn_service_apply_sms_keyword(text, text, text);
--   DROP TRIGGER IF EXISTS trg_sms_consent_events_immutable ON public.sms_consent_events;
--   DROP FUNCTION IF EXISTS public.fn_sms_consent_events_immutable();
--   DROP TABLE IF EXISTS public.sms_consent_events;
