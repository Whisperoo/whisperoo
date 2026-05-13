-- ============================================================================
-- Migration: Fix "Appointment checklist" KPI to use consultation_bookings
-- Purpose: The "Appointment checklist engagement" metric was incorrectly
--          querying care_checklist_progress (general checklist completion)
--          instead of actual appointment booking data from consultation_bookings.
-- ============================================================================

-- Create a new function that measures actual booking engagement
CREATE OR REPLACE FUNCTION public.fn_get_appointment_booking_engagement_pct(
  p_tenant_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := COALESCE(p_start_date::timestamptz, now() - interval '30 days');
  v_end   timestamptz := COALESCE((p_end_date::timestamptz) + interval '1 day' - interval '1 microsecond', now());
  v_total_enrolled int := 0;
  v_booked_users   int := 0;
BEGIN
  -- Denominator: total enrolled (onboarded) users, optionally scoped to tenant
  SELECT COUNT(*) INTO v_total_enrolled
  FROM public.profiles p
  WHERE p.onboarded = true
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  IF v_total_enrolled = 0 THEN
    RETURN 0;
  END IF;

  -- Numerator: distinct users who created at least one consultation booking in date range
  SELECT COUNT(DISTINCT cb.user_id) INTO v_booked_users
  FROM public.consultation_bookings cb
  JOIN public.profiles p ON p.id = cb.user_id
  WHERE (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND cb.booked_at >= v_start
    AND cb.booked_at <= v_end;

  RETURN ROUND(v_booked_users::numeric / v_total_enrolled * 100, 1);
END;
$$;

-- Grant access to authenticated users (admin dashboard calls this)
GRANT EXECUTE ON FUNCTION public.fn_get_appointment_booking_engagement_pct(uuid, date, date) TO authenticated;
