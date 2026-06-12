-- Fix fn_get_admin_dashboard: remove reference to profiles.email which was
-- dropped in the HIPAA migration (20260504000001_hipaa_remove_email.sql).
-- Auth guard now checks account_type only — no email column needed.

CREATE OR REPLACE FUNCTION public.fn_get_admin_dashboard(
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
  v_now              timestamptz := now();
  v_30d_ago          timestamptz := now() - interval '30 days';

  v_caller_role      text;

  v_effective_start  timestamptz;
  v_effective_end    timestamptz;
  v_prev_start       timestamptz;

  v_total_enrolled   int;
  v_prev_enrolled    int;
  v_enrolled_delta   numeric;

  v_flagged_curr     int;
  v_msgs_curr        int;
  v_flagged_prev     int;
  v_msgs_prev        int;
  v_escal_pct        numeric;
  v_escal_prev_pct   numeric;
  v_escal_delta      numeric;

  v_free_users       int;
  v_paid_users       int;
  v_consult_users    int;

  v_check_done       int;
  v_check_total      int;
  v_postpartum_pct   numeric;

  v_dau              int;
  v_mau              int;
  v_prev_dau         int;
  v_prev_mau         int;
  v_avg_session      numeric;
  v_prev_avg_session numeric;

  v_survey_users     int;
  v_survey_pct       numeric;

  v_prenatal_done    int;
  v_prenatal_total   int;
  v_prenatal_pct     numeric;

  v_lactation_appts  int;
  v_lactation_eng    int;
  v_hosp_res_eng     int;
  v_checklist_eng    int;

  v_result           jsonb;

BEGIN
  -- Guard: account_type only (profiles.email was removed in HIPAA migration)
  SELECT account_type INTO v_caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF COALESCE(v_caller_role, '') NOT IN ('admin', 'super_admin', 'superadmin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_effective_start := COALESCE(p_start_date::timestamptz, v_30d_ago);
  v_effective_end   := COALESCE(p_end_date::timestamptz + interval '1 day' - interval '1 microsecond', v_now);
  v_prev_start      := v_effective_start - (v_effective_end - v_effective_start);

  -- 1. Total Enrolled
  SELECT COUNT(*) INTO v_total_enrolled
  FROM profiles p
  WHERE p.onboarded = true
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND (p_start_date IS NULL OR p.created_at >= v_effective_start)
    AND (p_end_date IS NULL OR p.created_at <= v_effective_end);

  SELECT COUNT(*) INTO v_prev_enrolled
  FROM profiles p
  WHERE p.onboarded = true
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND p.created_at >= v_prev_start
    AND p.created_at < v_effective_start;

  v_enrolled_delta := CASE
    WHEN v_prev_enrolled > 0
      THEN ROUND(((v_total_enrolled - v_prev_enrolled)::numeric / v_prev_enrolled) * 100, 1)
    ELSE NULL
  END;

  -- 2. Escalation Signals
  SELECT
    COUNT(*) FILTER (WHERE m.is_flagged_for_review = true),
    COUNT(*)
  INTO v_flagged_curr, v_msgs_curr
  FROM messages m
  JOIN sessions s ON s.id = m.session_id
  JOIN profiles p ON p.id = s.user_id
  WHERE m.role = 'user'
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND m.created_at >= v_effective_start
    AND m.created_at <= v_effective_end;

  v_escal_pct := ROUND(v_flagged_curr::numeric / NULLIF(v_msgs_curr, 0) * 100, 1);

  SELECT
    COUNT(*) FILTER (WHERE m.is_flagged_for_review = true),
    COUNT(*)
  INTO v_flagged_prev, v_msgs_prev
  FROM messages m
  JOIN sessions s ON s.id = m.session_id
  JOIN profiles p ON p.id = s.user_id
  WHERE m.role = 'user'
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND m.created_at >= v_prev_start
    AND m.created_at < v_effective_start;

  v_escal_prev_pct := ROUND(v_flagged_prev::numeric / NULLIF(v_msgs_prev, 0) * 100, 1);
  v_escal_delta    := ROUND(COALESCE(v_escal_pct, 0) - COALESCE(v_escal_prev_pct, 0), 1);

  -- 3. Resource Metrics
  SELECT COUNT(DISTINCT pu.user_id) INTO v_free_users
  FROM purchases pu JOIN profiles p ON p.id = pu.user_id
  WHERE (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND pu.purchased_at >= v_effective_start AND pu.purchased_at <= v_effective_end;

  SELECT COUNT(DISTINCT pu.user_id) INTO v_paid_users
  FROM purchases pu
  JOIN products pr ON pr.id = pu.product_id
  JOIN profiles  p ON  p.id = pu.user_id
  WHERE pr.price > 0
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND pu.purchased_at >= v_effective_start AND pu.purchased_at <= v_effective_end;

  SELECT COUNT(DISTINCT pu.user_id) INTO v_consult_users
  FROM purchases pu
  JOIN products   pr ON pr.id = pu.product_id
  JOIN profiles    p ON  p.id = pu.user_id
  WHERE pr.product_type = 'consultation'
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND pu.purchased_at >= v_effective_start AND pu.purchased_at <= v_effective_end;

  -- 4. Postpartum checklist
  SELECT
    COUNT(*) FILTER (WHERE cp.completed = true),
    COUNT(*)
  INTO v_check_done, v_check_total
  FROM care_checklist_progress cp
  JOIN profiles p ON p.id = cp.user_id
  WHERE (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND cp.created_at >= v_effective_start AND cp.created_at <= v_effective_end;

  v_postpartum_pct := ROUND(v_check_done::numeric / NULLIF(v_check_total, 0) * 100, 1);

  -- 5. DAU / MAU / Avg Session
  SELECT COUNT(DISTINCT s.user_id) INTO v_dau
  FROM sessions s JOIN profiles p ON p.id = s.user_id
  WHERE s.created_at >= v_now - interval '1 day'
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  SELECT COUNT(DISTINCT s.user_id) INTO v_mau
  FROM sessions s JOIN profiles p ON p.id = s.user_id
  WHERE s.created_at >= v_effective_start AND s.created_at <= v_effective_end
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  SELECT COUNT(DISTINCT s.user_id) INTO v_prev_dau
  FROM sessions s JOIN profiles p ON p.id = s.user_id
  WHERE s.created_at >= v_now - interval '2 days'
    AND s.created_at  < v_now - interval '1 day'
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  SELECT COUNT(DISTINCT s.user_id) INTO v_prev_mau
  FROM sessions s JOIN profiles p ON p.id = s.user_id
  WHERE s.created_at >= v_prev_start AND s.created_at < v_effective_start
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (s.last_message_at - s.created_at)) / 60)::numeric, 1)
  INTO v_avg_session
  FROM sessions s JOIN profiles p ON p.id = s.user_id
  WHERE s.last_message_at IS NOT NULL
    AND s.created_at >= v_effective_start AND s.created_at <= v_effective_end
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (s.last_message_at - s.created_at)) / 60)::numeric, 1)
  INTO v_prev_avg_session
  FROM sessions s JOIN profiles p ON p.id = s.user_id
  WHERE s.last_message_at IS NOT NULL
    AND s.created_at >= v_prev_start AND s.created_at < v_effective_start
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  -- 6. Survey proxy
  SELECT COUNT(DISTINCT cp.user_id) INTO v_survey_users
  FROM care_checklist_progress cp
  JOIN profiles p ON p.id = cp.user_id
  WHERE cp.completed = true AND p.onboarded = true
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND cp.created_at >= v_effective_start AND cp.created_at <= v_effective_end;

  v_survey_pct := ROUND(v_survey_users::numeric / NULLIF(v_total_enrolled, 0) * 100, 1);

  -- 7. Prenatal proxy
  SELECT COUNT(DISTINCT cp.user_id) INTO v_prenatal_total
  FROM care_checklist_progress cp
  JOIN care_checklist_templates ct ON ct.id = cp.template_id
  JOIN profiles p ON p.id = cp.user_id
  WHERE ct.stage IN ('expecting_t1', 'reminder_prenatal_t1')
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND cp.created_at >= v_effective_start AND cp.created_at <= v_effective_end;

  SELECT COUNT(DISTINCT cp.user_id) INTO v_prenatal_done
  FROM care_checklist_progress cp
  JOIN care_checklist_templates ct ON ct.id = cp.template_id
  JOIN profiles p ON p.id = cp.user_id
  WHERE ct.stage IN ('expecting_t1', 'reminder_prenatal_t1') AND cp.completed = true
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND cp.created_at >= v_effective_start AND cp.created_at <= v_effective_end;

  v_prenatal_pct := ROUND(v_prenatal_done::numeric / NULLIF(v_prenatal_total, 0) * 100, 1);

  -- 8. Lactation
  SELECT COUNT(DISTINCT pu.id) INTO v_lactation_appts
  FROM purchases pu JOIN products pr ON pr.id = pu.product_id JOIN profiles p ON p.id = pu.user_id
  WHERE pr.product_type = 'consultation' AND pr.tags::text ILIKE '%lactation%'
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND pu.purchased_at >= v_effective_start AND pu.purchased_at <= v_effective_end;

  SELECT COUNT(*) INTO v_lactation_eng
  FROM purchases pu JOIN products pr ON pr.id = pu.product_id JOIN profiles p ON p.id = pu.user_id
  WHERE pr.tags::text ILIKE '%lactation%'
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND pu.purchased_at >= v_effective_start AND pu.purchased_at <= v_effective_end;

  -- 9. Hospital resource engagement
  SELECT COUNT(*) INTO v_hosp_res_eng
  FROM purchases pu JOIN products pr ON pr.id = pu.product_id JOIN profiles p ON p.id = pu.user_id
  WHERE pr.is_hospital_resource = true
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND pu.purchased_at >= v_effective_start AND pu.purchased_at <= v_effective_end;

  -- 10. Checklist engagement
  SELECT COUNT(*) INTO v_checklist_eng
  FROM care_checklist_progress cp JOIN profiles p ON p.id = cp.user_id
  WHERE cp.completed = true
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND cp.created_at >= v_effective_start AND cp.created_at <= v_effective_end;

  RETURN jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_enrolled',          v_total_enrolled,
      'total_enrolled_delta',    v_enrolled_delta,
      'escalation_pct',          COALESCE(v_escal_pct, 0),
      'escalation_delta',        v_escal_delta,
      'free_resources_pct',      ROUND(v_free_users::numeric  / NULLIF(v_total_enrolled, 0) * 100, 1),
      'resources_purchased_pct', ROUND(v_paid_users::numeric  / NULLIF(v_total_enrolled, 0) * 100, 1),
      'expert_support_pct',      ROUND(v_consult_users::numeric / NULLIF(v_total_enrolled, 0) * 100, 1),
      'survey_completion_pct',   v_survey_pct,
      'phreesia_risk_pct',       v_prenatal_pct,
      'postpartum_visits_pct',   v_postpartum_pct,
      'dau',                     v_dau,
      'dau_delta',               ROUND((v_dau - v_prev_dau)::numeric / NULLIF(v_prev_dau, 0) * 100, 1),
      'mau',                     v_mau,
      'mau_delta',               ROUND((v_mau - v_prev_mau)::numeric / NULLIF(v_prev_mau, 0) * 100, 1),
      'avg_session_minutes',     v_avg_session,
      'avg_session_delta',       ROUND(COALESCE(v_avg_session, 0) - COALESCE(v_prev_avg_session, 0), 1),
      'lactation_appointments',  COALESCE(v_lactation_appts, 0),
      'lactation_engagement',    COALESCE(v_lactation_eng, 0),
      'hospital_resource_eng',   COALESCE(v_hosp_res_eng, 0),
      'checklist_engagement',    COALESCE(v_checklist_eng, 0)
    ),
    'enrollment_trend', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('month', m, 'count', c) ORDER BY m)
      FROM (
        SELECT to_char(p.created_at, 'YYYY-MM') AS m, COUNT(*) AS c
        FROM profiles p
        WHERE p.onboarded = true
          AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
          AND p.created_at >= v_effective_start AND p.created_at <= v_effective_end
        GROUP BY 1
      ) sub
    ), '[]'::jsonb),
    'escalation_trend', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('month', m, 'rate', r) ORDER BY m)
      FROM (
        SELECT
          to_char(msg.created_at, 'YYYY-MM') AS m,
          ROUND(COUNT(*) FILTER (WHERE msg.is_flagged_for_review = true)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS r
        FROM messages msg
        JOIN sessions s ON s.id = msg.session_id
        JOIN profiles p ON p.id = s.user_id
        WHERE msg.role = 'user'
          AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
          AND msg.created_at >= v_effective_start AND msg.created_at <= v_effective_end
        GROUP BY 1
      ) sub
    ), '[]'::jsonb),
    'feature_usage', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('feature', f, 'count', c, 'pct', ROUND(c::numeric / NULLIF(v_total_enrolled, 0) * 100, 1)))
      FROM (
        SELECT 'AI Chat'   AS f, COUNT(DISTINCT s.user_id) AS c
        FROM sessions s JOIN profiles p ON p.id = s.user_id
        WHERE (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
          AND s.created_at >= v_effective_start AND s.created_at <= v_effective_end
        UNION ALL
        SELECT 'Purchases' AS f, COUNT(DISTINCT pu.user_id) AS c
        FROM purchases pu JOIN profiles p ON p.id = pu.user_id
        WHERE (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
          AND pu.purchased_at >= v_effective_start AND pu.purchased_at <= v_effective_end
        UNION ALL
        SELECT 'Checklist' AS f, COUNT(DISTINCT cp.user_id) AS c
        FROM care_checklist_progress cp JOIN profiles p ON p.id = cp.user_id
        WHERE (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
          AND cp.created_at >= v_effective_start AND cp.created_at <= v_effective_end
      ) sub
    ), '[]'::jsonb),
    'concern_themes',  '[]'::jsonb,
    'checklist_trend', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('month', m, 'rate', r) ORDER BY m)
      FROM (
        SELECT
          to_char(cp.created_at, 'YYYY-MM') AS m,
          ROUND(COUNT(*) FILTER (WHERE cp.completed = true)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS r
        FROM care_checklist_progress cp JOIN profiles p ON p.id = cp.user_id
        WHERE (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
          AND cp.created_at >= v_effective_start AND cp.created_at <= v_effective_end
        GROUP BY 1
      ) sub
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_admin_dashboard(uuid, date, date) TO authenticated;
