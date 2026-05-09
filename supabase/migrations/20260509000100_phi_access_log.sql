-- ============================================================================
-- PHI Access Logging (Append-only)
-- Purpose: Record every time an admin accesses conversation content (PHI).
-- Notes:
--  - Enforced append-only via triggers that reject UPDATE/DELETE.
--  - RLS enabled; no policies added (service role bypasses RLS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.phi_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accessed_at timestamptz NOT NULL DEFAULT now(),

  accessor_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  accessor_role text NOT NULL,

  patient_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,

  resource_type text NOT NULL, -- e.g. 'session', 'message'
  resource_id text NOT NULL,   -- session_id (uuid as text) or message_id (bigint as text)

  action text NOT NULL,        -- e.g. 'view_conversation'
  reason_code text NOT NULL,   -- enum-like in app ('user_reported_issue', ...)
  reason_text text
);

ALTER TABLE public.phi_access_log ENABLE ROW LEVEL SECURITY;

-- Append-only enforcement
CREATE OR REPLACE FUNCTION public.prevent_phi_access_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'phi_access_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_phi_access_log_no_update ON public.phi_access_log;
CREATE TRIGGER trg_phi_access_log_no_update
  BEFORE UPDATE ON public.phi_access_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_phi_access_log_mutation();

DROP TRIGGER IF EXISTS trg_phi_access_log_no_delete ON public.phi_access_log;
CREATE TRIGGER trg_phi_access_log_no_delete
  BEFORE DELETE ON public.phi_access_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_phi_access_log_mutation();

-- Explicitly revoke mutation privileges from client roles (defense-in-depth)
REVOKE UPDATE, DELETE ON public.phi_access_log FROM anon, authenticated;

