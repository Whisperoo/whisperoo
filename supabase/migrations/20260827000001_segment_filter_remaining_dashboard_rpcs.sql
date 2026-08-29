-- Extend the All / Hospital / B2C segment filter to the remaining dashboard RPCs.
--
-- Problem this fixes:
--   20260822000001 added p_segment to fn_get_admin_dashboard only. MetricsDash.tsx calls
--   FOUR RPCs, so wiring a segment selector to just the first produces a silently mixed
--   dashboard: the headline KPIs filter to the chosen segment while Resource Utilization,
--   QR signup metrics and the Appointment Booking KPI keep reporting all segments, with
--   nothing on screen saying so. On a HIPAA-adjacent reporting surface that is worse than
--   having no filter at all -- the numbers do not reconcile.
--
-- Approach:
--   Identical to 20260822000001. Each function gains p_segment text DEFAULT 'all' as the
--   LAST argument, so every existing 3-argument caller keeps its current behaviour, and
--   each inline tenancy predicate is replaced by fn_profile_in_segment (created in
--   20260822000001). Generated mechanically from the live definitions dumped from
--   production, with the transform asserting exactly 9 substitutions and 0 stale
--   predicates; everything outside those predicates is byte-identical to what is running.
--
--   Substitutions: fn_get_resource_utilization 5, fn_admin_qr_signup_metrics 2,
--   fn_get_appointment_booking_engagement_pct 2.
--
-- Two judgement calls worth recording:
--
--   1. product_analytics rows with no user (pa.user_id IS NULL) were previously counted
--      under ANY tenant filter, via `OR pa.user_id IS NULL`. Carrying that into segments
--      unchanged would double-count them in BOTH 'hospital' and 'b2c', so the segments
--      would not sum to 'all'. They are therefore included only when p_segment = 'all',
--      which preserves legacy behaviour exactly for the default and makes the segments
--      partition cleanly. Anonymous analytics rows cannot be attributed to a segment.
--
--   2. fn_admin_qr_signup_metrics filters QR codes by qc.tenant_id. Under 'b2c' the helper
--      requires tenant_id IS NULL, so it returns no QR codes. That is correct and
--      intentional: QR signups are hospital-attributed by definition, so "B2C QR signups"
--      is an empty set, not a bug.
--
-- The old 3-argument signatures are dropped first. Without that, adding a defaulted
-- fourth argument creates an overload and every existing 3-argument call becomes
-- ambiguous at runtime -- the same trap 20260822000001 documented.
--
-- Additive and reversible: rollback notes at the bottom.

-- ---------------------------------------------------------------------------
-- Drop old signatures before recreating with the extra argument
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fn_get_resource_utilization(uuid, date, date);
DROP FUNCTION IF EXISTS public.fn_admin_qr_signup_metrics(uuid, date, date);
DROP FUNCTION IF EXISTS public.fn_get_appointment_booking_engagement_pct(uuid, date, date);

CREATE OR REPLACE FUNCTION public.fn_get_resource_utilization(p_tenant_id uuid DEFAULT NULL::uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_segment text DEFAULT 'all') RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_caller_role text;
  v_result      jsonb;
BEGIN
  SELECT account_type INTO v_caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF COALESCE(v_caller_role, '') NOT IN ('admin', 'super_admin', 'superadmin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF COALESCE(p_segment, 'all') NOT IN ('all', 'hospital', 'b2c') THEN
    RAISE EXCEPTION 'Invalid segment: %. Expected all, hospital, or b2c.', p_segment;
  END IF;

  SELECT jsonb_agg(row_json ORDER BY (row_json->>'total_claims')::int DESC)
  INTO v_result
  FROM (
    SELECT
      p.id             AS product_id,
      p.title,
      p.product_type,
      p.is_hospital_resource,

      -- Claims: users who purchased / claimed access (was mislabeled "Downloads")
      COALESCE((
        SELECT COUNT(pu.id)
        FROM public.purchases pu
        LEFT JOIN public.profiles dp ON dp.id = pu.user_id
        WHERE pu.product_id = p.id
          AND pu.status = 'completed'
          AND (p_start_date IS NULL OR pu.purchased_at::date >= p_start_date)
          AND (p_end_date   IS NULL OR pu.purchased_at::date <= p_end_date)
          AND fn_profile_in_segment(dp.tenant_id, p_segment, p_tenant_id)
      ), 0) AS total_claims,

      -- Views: real opens from content viewer — excludes purchase-backfill rows
      COALESCE((
        SELECT COUNT(*)
        FROM public.product_analytics pa
        LEFT JOIN public.profiles vp ON vp.id = pa.user_id
        WHERE pa.product_id = p.id
          AND pa.event_type = 'view'
          AND (pa.session_id IS NULL OR pa.session_id NOT LIKE 'backfill-%')
          AND (p_start_date IS NULL OR pa.created_at::date >= p_start_date)
          AND (p_end_date   IS NULL OR pa.created_at::date <= p_end_date)
          AND (fn_profile_in_segment(vp.tenant_id, p_segment, p_tenant_id) OR (COALESCE(p_segment, 'all') = 'all' AND pa.user_id IS NULL))
      ), 0) AS total_views,

      -- Downloads: actual PDF file downloads via the Download button
      COALESCE((
        SELECT COUNT(*)
        FROM public.product_analytics pa
        LEFT JOIN public.profiles dlp ON dlp.id = pa.user_id
        WHERE pa.product_id = p.id
          AND pa.event_type = 'download'
          AND (p_start_date IS NULL OR pa.created_at::date >= p_start_date)
          AND (p_end_date   IS NULL OR pa.created_at::date <= p_end_date)
          AND (fn_profile_in_segment(dlp.tenant_id, p_segment, p_tenant_id) OR (COALESCE(p_segment, 'all') = 'all' AND pa.user_id IS NULL))
      ), 0) AS total_downloads,

      -- Saves: wishlist saves
      COALESCE((
        SELECT COUNT(pw.id)
        FROM public.product_wishlists pw
        LEFT JOIN public.profiles sp ON sp.id = pw.user_id
        WHERE pw.product_id = p.id
          AND (p_start_date IS NULL OR pw.created_at::date >= p_start_date)
          AND (p_end_date   IS NULL OR pw.created_at::date <= p_end_date)
          AND fn_profile_in_segment(sp.tenant_id, p_segment, p_tenant_id)
      ), 0) AS total_saves,

      -- Revenue
      COALESCE((
        SELECT SUM(pu.amount)
        FROM public.purchases pu
        LEFT JOIN public.profiles rp ON rp.id = pu.user_id
        WHERE pu.product_id = p.id
          AND pu.status = 'completed'
          AND (p_start_date IS NULL OR pu.purchased_at::date >= p_start_date)
          AND (p_end_date   IS NULL OR pu.purchased_at::date <= p_end_date)
          AND fn_profile_in_segment(rp.tenant_id, p_segment, p_tenant_id)
      ), 0) AS total_revenue

    FROM public.products p
  ) t
  CROSS JOIN LATERAL (
    SELECT jsonb_build_object(
      'product_id',           product_id,
      'title',                title,
      'product_type',         product_type,
      'is_hospital_resource', is_hospital_resource,
      'total_claims',         total_claims,
      'total_views',          total_views,
      'total_downloads',      total_downloads,
      'total_saves',          total_saves,
      'total_revenue',        total_revenue
    ) AS row_json
  ) j;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_admin_qr_signup_metrics(p_tenant_id uuid DEFAULT NULL::uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_segment text DEFAULT 'all') RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

  IF COALESCE(p_segment, 'all') NOT IN ('all', 'hospital', 'b2c') THEN
    RAISE EXCEPTION 'Invalid segment: %. Expected all, hospital, or b2c.', p_segment;
  END IF;

  RETURN (
    WITH qr AS (
      SELECT qc.*
      FROM public.qr_codes qc
      WHERE fn_profile_in_segment(qc.tenant_id, p_segment, p_tenant_id)
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
        AND fn_profile_in_segment(p.tenant_id, p_segment, p_tenant_id)
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

CREATE OR REPLACE FUNCTION public.fn_get_appointment_booking_engagement_pct(p_tenant_id uuid DEFAULT NULL::uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_segment text DEFAULT 'all') RETURNS numeric
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_start timestamptz := COALESCE(p_start_date::timestamptz, now() - interval '30 days');
  v_end   timestamptz := COALESCE((p_end_date::timestamptz) + interval '1 day' - interval '1 microsecond', now());
  v_total_enrolled int := 0;
  v_booked_users   int := 0;
BEGIN
  IF COALESCE(p_segment, 'all') NOT IN ('all', 'hospital', 'b2c') THEN
    RAISE EXCEPTION 'Invalid segment: %. Expected all, hospital, or b2c.', p_segment;
  END IF;
  -- Denominator: total enrolled (onboarded) users, optionally scoped to tenant
  SELECT COUNT(*) INTO v_total_enrolled
  FROM public.profiles p
  WHERE p.onboarded = true
    AND fn_profile_in_segment(p.tenant_id, p_segment, p_tenant_id);

  IF v_total_enrolled = 0 THEN
    RETURN 0;
  END IF;

  -- Numerator: distinct users who created at least one consultation booking in date range
  SELECT COUNT(DISTINCT cb.user_id) INTO v_booked_users
  FROM public.consultation_bookings cb
  JOIN public.profiles p ON p.id = cb.user_id
  WHERE fn_profile_in_segment(p.tenant_id, p_segment, p_tenant_id)
    AND cb.booked_at >= v_start
    AND cb.booked_at <= v_end;

  RETURN ROUND(v_booked_users::numeric / v_total_enrolled * 100, 1);
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants -- mirror exactly what the 3-argument signatures had in production
-- ---------------------------------------------------------------------------
GRANT ALL ON FUNCTION public.fn_get_resource_utilization(uuid, date, date, text) TO anon;
GRANT ALL ON FUNCTION public.fn_get_resource_utilization(uuid, date, date, text) TO authenticated;
GRANT ALL ON FUNCTION public.fn_get_resource_utilization(uuid, date, date, text) TO service_role;

GRANT ALL ON FUNCTION public.fn_admin_qr_signup_metrics(uuid, date, date, text) TO anon;
GRANT ALL ON FUNCTION public.fn_admin_qr_signup_metrics(uuid, date, date, text) TO authenticated;
GRANT ALL ON FUNCTION public.fn_admin_qr_signup_metrics(uuid, date, date, text) TO service_role;

GRANT ALL ON FUNCTION public.fn_get_appointment_booking_engagement_pct(uuid, date, date, text) TO anon;
GRANT ALL ON FUNCTION public.fn_get_appointment_booking_engagement_pct(uuid, date, date, text) TO authenticated;
GRANT ALL ON FUNCTION public.fn_get_appointment_booking_engagement_pct(uuid, date, date, text) TO service_role;

-- ---------------------------------------------------------------------------
-- ROLLBACK (manual)
--   DROP FUNCTION IF EXISTS public.fn_get_resource_utilization(uuid, date, date, text);
--   DROP FUNCTION IF EXISTS public.fn_admin_qr_signup_metrics(uuid, date, date, text);
--   DROP FUNCTION IF EXISTS public.fn_get_appointment_booking_engagement_pct(uuid, date, date, text);
--   ...then restore the 3-argument definitions from the prior migration history.
-- ---------------------------------------------------------------------------
