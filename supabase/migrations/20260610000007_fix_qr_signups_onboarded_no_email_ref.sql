-- Corrected version of 20260610000003 (supersedes it — do not run 000003).
--
-- Two bugs in 000003:
--   1. Auth guard referenced profiles.email (dropped in HIPAA migration 20260504000001)
--   2. unattributed CTE selected p.email (same dropped column)
--
-- This version:
--   - Auth: account_type check only (no email column)
--   - unattributed CTE: NULL::text AS email (preserves output shape for frontend)
--   - Adds onboarded = true filter to attributed_signups, unattributed, and by_qr signups

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

  SELECT account_type
  INTO v_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF COALESCE(v_role, '') NOT IN ('admin', 'super_admin', 'superadmin') THEN
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
    ),
    attributed_signups AS (
      SELECT count(DISTINCT p.id) AS cnt
      FROM public.profiles p
      JOIN qr ON qr.id = p.signup_qr_code_id
      WHERE p.onboarded = true
        AND (p_start_date IS NULL OR p.created_at::date >= p_start_date)
        AND (p_end_date IS NULL OR p.created_at::date <= p_end_date)
    ),
    unattributed AS (
      SELECT
        p.id,
        p.first_name,
        NULL::text AS email,
        p.tenant_id,
        p.acquisition_source,
        p.acquisition_department,
        p.created_at
      FROM public.profiles p
      WHERE p.onboarded = true
        AND p.signup_qr_code_id IS NULL
        AND p.acquisition_source = 'qr_hospital'
        AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
        AND (p_start_date IS NULL OR p.created_at::date >= p_start_date)
        AND (p_end_date IS NULL OR p.created_at::date <= p_end_date)
    )
    SELECT jsonb_build_object(
      'totals', jsonb_build_object(
        'scans',                COALESCE((SELECT count(*) FROM ev JOIN qr ON qr.id = ev.qr_code_id WHERE ev.event_type = 'scan'), 0),
        'signups',              COALESCE((SELECT cnt FROM attributed_signups), 0) + COALESCE((SELECT count(*) FROM unattributed), 0),
        'attributed_signups',   COALESCE((SELECT cnt FROM attributed_signups), 0),
        'unattributed_signups', COALESCE((SELECT count(*) FROM unattributed), 0)
      ),
      'by_qr', COALESCE((
        SELECT jsonb_agg(row_json ORDER BY (row_json->>'scans')::int DESC)
        FROM (
          SELECT jsonb_build_object(
            'qr_code_id', qc.id,
            'token',      qc.token,
            'label',      qc.label,
            'department', qc.department,
            'tenant_id',  qc.tenant_id,
            'scans',      COALESCE(s.scans, 0),
            'signups',    COALESCE(u.signups, 0)
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
            WHERE onboarded = true
              AND signup_qr_code_id IS NOT NULL
              AND (p_start_date IS NULL OR created_at::date >= p_start_date)
              AND (p_end_date IS NULL OR created_at::date <= p_end_date)
            GROUP BY signup_qr_code_id
          ) u ON u.qr_code_id = qc.id
          WHERE qc.is_active = true
        ) t
      ), '[]'::jsonb),
      'unattributed_rows', COALESCE((
        SELECT jsonb_agg(row_to_json(x))
        FROM (
          SELECT id, first_name, email, tenant_id, acquisition_source, acquisition_department, created_at
          FROM unattributed
          ORDER BY created_at DESC
          LIMIT 100
        ) x
      ), '[]'::jsonb)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_admin_qr_signup_metrics(uuid, date, date) TO authenticated;
