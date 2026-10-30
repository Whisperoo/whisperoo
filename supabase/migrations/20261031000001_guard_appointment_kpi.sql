-- =============================================================================
-- Security: admin-only Appointment Booking Engagement KPI (2026-10-31)
--
-- Found in the contract audit. fn_get_appointment_booking_engagement_pct is SECURITY
-- DEFINER with no caller check, and EXECUTE was granted to anon — so anyone holding
-- the public anon key (it ships in the frontend bundle) could read a hospital's
-- booking-engagement percentage for any tenant/segment. Aggregate only, but it is a
-- dashboard metric and every sibling dashboard RPC is already staff-admin only.
--
-- Body is prod's current definition (identical on staging) plus the guard. The only
-- caller is MetricsDash (staff admins), which already treats an error as unavailable.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_get_appointment_booking_engagement_pct(p_tenant_id uuid DEFAULT NULL::uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_segment text DEFAULT 'all'::text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_start timestamptz := COALESCE(p_start_date::timestamptz, now() - interval '30 days');
  v_end   timestamptz := COALESCE((p_end_date::timestamptz) + interval '1 day' - interval '1 microsecond', now());
  v_total_enrolled int := 0;
  v_booked_users   int := 0;
BEGIN
  -- Staff admins only (added 2026-10-31). Before this, anon and any signed-in user
  -- could call it with the public anon key and read a hospital's booking rate.
  IF NOT public.fn_caller_is_staff_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

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
$function$;

REVOKE ALL ON FUNCTION public.fn_get_appointment_booking_engagement_pct(uuid, date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_appointment_booking_engagement_pct(uuid, date, date, text) TO authenticated;

-- ROLLBACK: re-create the function without the guard (definition in 20260827000001)
--   and GRANT EXECUTE ... TO anon;
