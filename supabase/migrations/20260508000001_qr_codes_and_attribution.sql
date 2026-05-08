-- 20260508000001_qr_codes_and_attribution.sql
-- Purpose: Immutable QR tokens + scan/signup attribution + admin metrics

-- 1) Immutable QR tokens per tenant (and optionally per location)
CREATE TABLE IF NOT EXISTS public.qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  label text,
  department text,
  source text NOT NULL DEFAULT 'qr_hospital',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent updating token after creation (token is what is printed)
CREATE OR REPLACE FUNCTION public.fn_prevent_qr_token_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.token IS DISTINCT FROM OLD.token THEN
    RAISE EXCEPTION 'QR token is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_qr_token_update ON public.qr_codes;
CREATE TRIGGER trg_prevent_qr_token_update
BEFORE UPDATE ON public.qr_codes
FOR EACH ROW
EXECUTE FUNCTION public.fn_prevent_qr_token_update();

-- 2) Append-only QR events (scan/signup)
CREATE TABLE IF NOT EXISTS public.qr_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id uuid NOT NULL REFERENCES public.qr_codes(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('scan','signup_start','signup_complete')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  anon_id text,
  user_id uuid REFERENCES auth.users(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_qr_events_qr_code_id ON public.qr_events(qr_code_id);
CREATE INDEX IF NOT EXISTS idx_qr_events_occurred_at ON public.qr_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_qr_events_user_id ON public.qr_events(user_id);
CREATE INDEX IF NOT EXISTS idx_qr_events_anon_id ON public.qr_events(anon_id);

-- 3) Stable attribution fields on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_qr_code_id uuid REFERENCES public.qr_codes(id),
  ADD COLUMN IF NOT EXISTS signup_qr_anon_id text,
  ADD COLUMN IF NOT EXISTS signup_qr_at timestamptz;

-- 4) RLS
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_events ENABLE ROW LEVEL SECURITY;

-- Anyone can resolve active QR codes (needed before auth)
DROP POLICY IF EXISTS "Anyone can view active qr codes" ON public.qr_codes;
CREATE POLICY "Anyone can view active qr codes"
  ON public.qr_codes FOR SELECT
  USING (is_active = true);

-- QR events: public can insert scans only (no user_id)
DROP POLICY IF EXISTS "Anon can log qr scans" ON public.qr_events;
CREATE POLICY "Anon can log qr scans"
  ON public.qr_events FOR INSERT
  WITH CHECK (
    event_type = 'scan'
    AND user_id IS NULL
  );

-- Authenticated users can log their own signup events
DROP POLICY IF EXISTS "Users can log own qr signup events" ON public.qr_events;
CREATE POLICY "Users can log own qr signup events"
  ON public.qr_events FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND event_type IN ('signup_start','signup_complete')
  );

-- Admin/superadmin can read qr codes and events for reporting
-- We keep reads off the public tables and expose via RPC, but this SELECT policy
-- is still useful for superadmin tooling and debugging.
DROP POLICY IF EXISTS "Admins can read qr codes" ON public.qr_codes;
CREATE POLICY "Admins can read qr codes"
  ON public.qr_codes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin','super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can read qr events" ON public.qr_events;
CREATE POLICY "Admins can read qr events"
  ON public.qr_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin','super_admin')
    )
  );

-- 5) Admin metrics RPC
CREATE OR REPLACE FUNCTION public.fn_admin_qr_signup_metrics(
  p_tenant_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT account_type INTO v_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role NOT IN ('admin','super_admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN (
    WITH qr AS (
      SELECT qc.*
      FROM public.qr_codes qc
      WHERE (p_tenant_id IS NULL OR qc.tenant_id = p_tenant_id)
    ),
    ev AS (
      SELECT e.*
      FROM public.qr_events e
      WHERE (p_start_date IS NULL OR e.occurred_at::date >= p_start_date)
        AND (p_end_date IS NULL OR e.occurred_at::date <= p_end_date)
    )
    SELECT jsonb_build_object(
      'totals', jsonb_build_object(
        'scans', COALESCE((SELECT count(*) FROM ev JOIN qr ON qr.id = ev.qr_code_id WHERE ev.event_type = 'scan'), 0),
        'signups', COALESCE((SELECT count(DISTINCT p.id) FROM public.profiles p JOIN qr ON qr.id = p.signup_qr_code_id WHERE (p_start_date IS NULL OR p.created_at::date >= p_start_date) AND (p_end_date IS NULL OR p.created_at::date <= p_end_date)), 0)
      ),
      'by_qr', COALESCE((
        SELECT jsonb_agg(row_json ORDER BY (row_json->>'scans')::int DESC)
        FROM (
          SELECT jsonb_build_object(
            'qr_code_id', qc.id,
            'token', qc.token,
            'label', qc.label,
            'department', qc.department,
            'tenant_id', qc.tenant_id,
            'scans', COALESCE(s.scans, 0),
            'signups', COALESCE(u.signups, 0)
          ) AS row_json
          FROM qr qc
          LEFT JOIN (
            SELECT qr_code_id, count(*) AS scans
            FROM ev
            WHERE event_type = 'scan'
            GROUP BY qr_code_id
          ) s ON s.qr_code_id = qc.id
          LEFT JOIN (
            SELECT signup_qr_code_id AS qr_code_id, count(*) AS signups
            FROM public.profiles
            WHERE signup_qr_code_id IS NOT NULL
              AND (p_start_date IS NULL OR created_at::date >= p_start_date)
              AND (p_end_date IS NULL OR created_at::date <= p_end_date)
            GROUP BY signup_qr_code_id
          ) u ON u.qr_code_id = qc.id
          WHERE qc.is_active = true
        ) t
      ), '[]'::jsonb)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_admin_qr_signup_metrics(uuid, date, date) TO authenticated;

