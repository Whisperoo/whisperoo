-- ============================================================================
-- QR metrics robustness:
-- 1) Backfill profiles.signup_qr_code_id from qr_events.signup_complete
-- 2) Include unattributed QR-hospital signups in totals
-- ============================================================================

-- Backfill missing profile attribution when we have explicit signup_complete event
WITH latest_signup_events AS (
  SELECT DISTINCT ON (e.user_id)
    e.user_id,
    e.qr_code_id,
    e.occurred_at
  FROM public.qr_events e
  WHERE e.event_type = 'signup_complete'
    AND e.user_id IS NOT NULL
    AND e.qr_code_id IS NOT NULL
  ORDER BY e.user_id, e.occurred_at DESC
)
UPDATE public.profiles p
SET
  signup_qr_code_id = l.qr_code_id,
  signup_qr_at = COALESCE(p.signup_qr_at, l.occurred_at)
FROM latest_signup_events l
WHERE p.id = l.user_id
  AND p.signup_qr_code_id IS NULL;


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
  v_profile_email text;
  v_jwt_email text;
  v_effective_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT account_type, lower(email)
  INTO v_role, v_profile_email
  FROM public.profiles
  WHERE id = auth.uid();

  v_jwt_email := lower(COALESCE((auth.jwt() ->> 'email'), ''));
  v_effective_email := COALESCE(NULLIF(v_profile_email, ''), NULLIF(v_jwt_email, ''));

  IF COALESCE(v_role, '') NOT IN ('admin','super_admin','superadmin')
     AND COALESCE(v_effective_email, '') NOT IN ('engineering@whisperoo.app','sharab.khan101010@gmail.com') THEN
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
      WHERE (p_start_date IS NULL OR p.created_at::date >= p_start_date)
        AND (p_end_date IS NULL OR p.created_at::date <= p_end_date)
    ),
    unattributed_signups AS (
      SELECT count(DISTINCT p.id) AS cnt
      FROM public.profiles p
      WHERE p.signup_qr_code_id IS NULL
        AND p.acquisition_source = 'qr_hospital'
        AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
        AND (p_start_date IS NULL OR p.created_at::date >= p_start_date)
        AND (p_end_date IS NULL OR p.created_at::date <= p_end_date)
    )
    SELECT jsonb_build_object(
      'totals', jsonb_build_object(
        'scans', COALESCE((SELECT count(*) FROM ev JOIN qr ON qr.id = ev.qr_code_id WHERE ev.event_type = 'scan'), 0),
        'signups', COALESCE((SELECT cnt FROM attributed_signups), 0) + COALESCE((SELECT cnt FROM unattributed_signups), 0),
        'attributed_signups', COALESCE((SELECT cnt FROM attributed_signups), 0),
        'unattributed_signups', COALESCE((SELECT cnt FROM unattributed_signups), 0)
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

