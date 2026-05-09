-- ============================================================================
-- Fix: fn_admin_qr_signup_metrics auth gate for superadmin variants
-- ============================================================================

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
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT account_type, lower(email)
  INTO v_role, v_email
  FROM public.profiles
  WHERE id = auth.uid();

  IF COALESCE(v_role, '') NOT IN ('admin','super_admin','superadmin')
     AND COALESCE(v_email, '') NOT IN ('engineering@whisperoo.app','sharab.khan101010@gmail.com') THEN
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

