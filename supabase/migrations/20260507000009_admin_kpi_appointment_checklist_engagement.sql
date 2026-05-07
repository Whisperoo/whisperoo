-- Migration: Admin KPI - Appointment checklist engagement %
-- Computes % of enrolled users who completed at least one appointment reminder checklist item
-- Appointment reminders are care_checklist_templates with stage key: 'reminder_%'

CREATE OR REPLACE FUNCTION public.fn_get_appointment_checklist_engagement_pct(
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
  v_now timestamptz := now();
  v_start timestamptz := COALESCE(p_start_date::timestamptz, now() - interval '30 days');
  v_end   timestamptz := COALESCE(p_end_date::timestamptz + interval '1 day' - interval '1 microsecond', v_now);
  v_total_enrolled int := 0;
  v_engaged_users  int := 0;
BEGIN
  -- Denominator: total enrolled users for tenant (ignores date range, to keep KPI stable)
  SELECT COUNT(*)
    INTO v_total_enrolled
  FROM public.profiles p
  WHERE p.onboarded = true
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  -- Numerator: distinct users who completed at least one appointment reminder checklist item in date range
  SELECT COUNT(DISTINCT cp.user_id)
    INTO v_engaged_users
  FROM public.care_checklist_progress cp
  JOIN public.care_checklist_templates ct ON ct.id = cp.template_id
  JOIN public.profiles p ON p.id = cp.user_id
  WHERE cp.completed = true
    AND ct.stage LIKE 'reminder_%'
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND cp.created_at >= v_start
    AND cp.created_at <= v_end;

  RETURN ROUND(v_engaged_users::numeric / NULLIF(v_total_enrolled, 0) * 100, 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_appointment_checklist_engagement_pct(uuid, date, date) TO authenticated;

