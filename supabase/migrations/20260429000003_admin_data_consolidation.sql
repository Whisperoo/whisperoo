-- =============================================================
-- 20260429000003_admin_data_consolidation.sql
-- Consolidation migration to ensure all admin dashboard views and
-- functions are up to date in production.
--
-- Applies:
--   1. admin_ai_audit_trail view — with user_id, cohort, HIPAA-safe
--   2. fn_get_admin_dashboard — wired to real data (all KPIs live)
--
-- Run this in Supabase SQL editor if migrations were not applied.
-- =============================================================

-- ── 1. Recreate HIPAA-safe audit trail view ──────────────────
DROP VIEW IF EXISTS public.admin_ai_audit_trail;

CREATE VIEW public.admin_ai_audit_trail AS
SELECT
  m.id                                                        AS message_id,
  m.created_at,
  s.user_id,
  p.tenant_id,
  CASE
    WHEN p.acquisition_source IS NOT NULL
      THEN 'COHORT-' || UPPER(p.acquisition_source)
    ELSE 'COHORT-GENERAL'
  END                                                         AS cohort,
  COALESCE(m.metadata->>'category', 'General Parenting')     AS category,
  LEFT(m.content, 150)                                        AS summary,
  m.is_flagged_for_review                                     AS escalation,
  m.metadata
FROM public.messages m
JOIN public.sessions  s ON s.id = m.session_id
JOIN public.profiles  p ON p.id = s.user_id
WHERE m.role = 'user'
ORDER BY m.created_at DESC;

GRANT SELECT ON public.admin_ai_audit_trail TO authenticated;

-- ── 2. Refresh fn_get_admin_dashboard with all real KPIs ─────
-- (Full definition — idempotent via CREATE OR REPLACE)

CREATE OR REPLACE FUNCTION public.fn_get_admin_dashboard(
  p_tenant_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now              timestamptz := now();
  v_30d_ago          timestamptz := now() - interval '30 days';
  v_60d_ago          timestamptz := now() - interval '60 days';
  v_6m_ago           timestamptz := now() - interval '6 months';

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

  v_enrollment_trend  jsonb;
  v_escalation_trend  jsonb;
  v_feature_usage     jsonb;
  v_concern_themes    jsonb;
  v_checklist_trend   jsonb;
  v_result            jsonb;

BEGIN

  -- Guard: super-admin only
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) NOT IN
     ('engineering@whisperoo.app')
  THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- 1. Total Enrolled
  SELECT COUNT(*) INTO v_total_enrolled
  FROM profiles p
  WHERE p.onboarded = true
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  SELECT COUNT(*) INTO v_prev_enrolled
  FROM profiles p
  WHERE p.onboarded = true
    AND p.created_at < v_30d_ago
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

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
    AND m.created_at >= v_30d_ago
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  v_escal_pct := ROUND(v_flagged_curr::numeric / NULLIF(v_msgs_curr, 0) * 100, 1);

  SELECT
    COUNT(*) FILTER (WHERE m.is_flagged_for_review = true),
    COUNT(*)
  INTO v_flagged_prev, v_msgs_prev
  FROM messages m
  JOIN sessions s ON s.id = m.session_id
  JOIN profiles p ON p.id = s.user_id
  WHERE m.role = 'user'
    AND m.created_at >= v_60d_ago AND m.created_at < v_30d_ago
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  v_escal_prev_pct := ROUND(v_flagged_prev::numeric / NULLIF(v_msgs_prev, 0) * 100, 1);
  v_escal_delta    := ROUND(COALESCE(v_escal_pct, 0) - COALESCE(v_escal_prev_pct, 0), 1);

  -- 3. Resource Metrics (using purchases table)
  SELECT COUNT(DISTINCT pu.user_id) INTO v_free_users
  FROM purchases pu JOIN profiles p ON p.id = pu.user_id
  WHERE (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  SELECT COUNT(DISTINCT pu.user_id) INTO v_paid_users
  FROM purchases pu
  JOIN products pr ON pr.id = pu.product_id
  JOIN profiles  p ON  p.id = pu.user_id
  WHERE pr.price > 0
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  SELECT COUNT(DISTINCT pu.user_id) INTO v_consult_users
  FROM purchases pu
  JOIN products   pr ON pr.id = pu.product_id
  JOIN profiles    p ON  p.id = pu.user_id
  WHERE pr.product_type = 'consultation'
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  -- 4. Postpartum checklist completion rate
  SELECT
    COUNT(*) FILTER (WHERE cp.completed = true),
    COUNT(*)
  INTO v_check_done, v_check_total
  FROM care_checklist_progress cp
  JOIN profiles p ON p.id = cp.user_id
  WHERE (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  v_postpartum_pct := ROUND(v_check_done::numeric / NULLIF(v_check_total, 0) * 100, 1);

  -- 5. DAU / MAU / Avg Session
  SELECT COUNT(DISTINCT s.user_id) INTO v_dau
  FROM sessions s JOIN profiles p ON p.id = s.user_id
  WHERE s.created_at >= v_now - interval '1 day'
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  SELECT COUNT(DISTINCT s.user_id) INTO v_mau
  FROM sessions s JOIN profiles p ON p.id = s.user_id
  WHERE s.created_at >= v_30d_ago
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  SELECT COUNT(DISTINCT s.user_id) INTO v_prev_dau
  FROM sessions s JOIN profiles p ON p.id = s.user_id
  WHERE s.created_at >= v_now - interval '2 days'
    AND s.created_at  < v_now - interval '1 day'
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  SELECT COUNT(DISTINCT s.user_id) INTO v_prev_mau
  FROM sessions s JOIN profiles p ON p.id = s.user_id
  WHERE s.created_at >= v_60d_ago AND s.created_at < v_30d_ago
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (s.last_message_at - s.created_at)) / 60)::numeric, 1)
  INTO v_avg_session
  FROM sessions s JOIN profiles p ON p.id = s.user_id
  WHERE s.last_message_at IS NOT NULL AND s.created_at >= v_30d_ago
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (s.last_message_at - s.created_at)) / 60)::numeric, 1)
  INTO v_prev_avg_session
  FROM sessions s JOIN profiles p ON p.id = s.user_id
  WHERE s.last_message_at IS NOT NULL
    AND s.created_at >= v_60d_ago AND s.created_at < v_30d_ago
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  -- 6. Survey Completion Proxy (enrolled users with ≥1 completed checklist)
  SELECT COUNT(DISTINCT cp.user_id) INTO v_survey_users
  FROM care_checklist_progress cp
  JOIN profiles p ON p.id = cp.user_id
  WHERE cp.completed = true
    AND p.onboarded = true
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  v_survey_pct := ROUND(v_survey_users::numeric / NULLIF(v_total_enrolled, 0) * 100, 1);

  -- 7. Prenatal Risk Assessment Proxy
  SELECT COUNT(DISTINCT cp.user_id) INTO v_prenatal_total
  FROM care_checklist_progress cp
  JOIN care_checklist_templates ct ON ct.id = cp.template_id
  JOIN profiles p ON p.id = cp.user_id
  WHERE ct.stage IN ('expecting_t1', 'reminder_prenatal_t1')
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  SELECT COUNT(DISTINCT cp.user_id) INTO v_prenatal_done
  FROM care_checklist_progress cp
  JOIN care_checklist_templates ct ON ct.id = cp.template_id
  JOIN profiles p ON p.id = cp.user_id
  WHERE ct.stage IN ('expecting_t1', 'reminder_prenatal_t1')
    AND cp.completed = true
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  v_prenatal_pct := ROUND(v_prenatal_done::numeric / NULLIF(v_prenatal_total, 0) * 100, 1);

  -- 8. Enrollment Trend (6 months)
  SELECT jsonb_agg(row_json ORDER BY month_date)
  INTO v_enrollment_trend
  FROM (
    SELECT
      DATE_TRUNC('month', created_at)                      AS month_date,
      TO_CHAR(DATE_TRUNC('month', created_at), 'Mon')      AS month_label,
      COUNT(*)                                             AS cnt
    FROM profiles
    WHERE onboarded = true
      AND created_at >= v_6m_ago
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
    GROUP BY DATE_TRUNC('month', created_at)
  ) t
  CROSS JOIN LATERAL (
    SELECT jsonb_build_object('month', month_label, 'count', cnt) AS row_json
  ) j;

  -- 9. Escalation Trend (6 months)
  SELECT jsonb_agg(row_json ORDER BY month_date)
  INTO v_escalation_trend
  FROM (
    SELECT
      DATE_TRUNC('month', m.created_at)                    AS month_date,
      TO_CHAR(DATE_TRUNC('month', m.created_at), 'Mon')    AS month_label,
      ROUND(
        COUNT(*) FILTER (WHERE m.is_flagged_for_review)::numeric
        / NULLIF(COUNT(*), 0) * 100, 1
      )                                                    AS rate
    FROM messages m
    JOIN sessions s ON s.id = m.session_id
    JOIN profiles p ON p.id = s.user_id
    WHERE m.role = 'user'
      AND m.created_at >= v_6m_ago
      AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    GROUP BY DATE_TRUNC('month', m.created_at)
  ) t
  CROSS JOIN LATERAL (
    SELECT jsonb_build_object('month', month_label, 'rate', rate) AS row_json
  ) j;

  -- 10. Feature Usage Breakdown
  SELECT jsonb_agg(row_json ORDER BY cnt DESC)
  INTO v_feature_usage
  FROM (
    SELECT feature, cnt,
      ROUND(cnt::numeric / NULLIF(SUM(cnt) OVER (), 0) * 100, 1) AS pct
    FROM (
      SELECT 'AI Chat' AS feature, COUNT(*) AS cnt
      FROM messages m
      JOIN sessions s ON s.id = m.session_id
      JOIN profiles p ON p.id = s.user_id
      WHERE m.role = 'user'
        AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
      UNION ALL
      SELECT 'Resource Visits', COUNT(DISTINCT pu.id)
      FROM purchases pu
      JOIN products pr ON pr.id = pu.product_id
      JOIN profiles  p ON  p.id = pu.user_id
      WHERE pr.product_type != 'consultation'
        AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
      UNION ALL
      SELECT 'Expert Booking', COUNT(DISTINCT pu.id)
      FROM purchases pu
      JOIN products pr ON pr.id = pu.product_id
      JOIN profiles  p ON  p.id = pu.user_id
      WHERE pr.product_type = 'consultation'
        AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
      UNION ALL
      SELECT 'Services', COUNT(*)
      FROM care_checklist_progress cp
      JOIN profiles p ON p.id = cp.user_id
      WHERE (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    ) raw_counts
  ) counts
  CROSS JOIN LATERAL (
    SELECT jsonb_build_object('feature', feature, 'count', cnt, 'pct', pct) AS row_json
  ) j;

  -- 11. Common Concern Themes
  SELECT jsonb_agg(row_json ORDER BY cnt DESC)
  INTO v_concern_themes
  FROM (
    SELECT
      COALESCE(m.metadata->>'category', 'General Parenting') AS category,
      COUNT(*)                                               AS cnt
    FROM messages m
    JOIN sessions s ON s.id = m.session_id
    JOIN profiles p ON p.id = s.user_id
    WHERE m.role = 'user'
      AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    GROUP BY COALESCE(m.metadata->>'category', 'General Parenting')
    ORDER BY cnt DESC
    LIMIT 8
  ) t
  CROSS JOIN LATERAL (
    SELECT jsonb_build_object('category', category, 'count', cnt) AS row_json
  ) j;

  -- 12. Checklist Completion Trend (6 months)
  SELECT jsonb_agg(row_json ORDER BY month_date)
  INTO v_checklist_trend
  FROM (
    SELECT
      DATE_TRUNC('month', cp.completed_at)                   AS month_date,
      TO_CHAR(DATE_TRUNC('month', cp.completed_at), 'Mon')   AS month_label,
      ROUND(
        COUNT(*) FILTER (WHERE cp.completed = true)::numeric
        / NULLIF(COUNT(*), 0) * 100, 1
      )                                                      AS rate
    FROM care_checklist_progress cp
    JOIN profiles p ON p.id = cp.user_id
    WHERE cp.completed_at IS NOT NULL
      AND cp.completed_at >= v_6m_ago
      AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    GROUP BY DATE_TRUNC('month', cp.completed_at)
  ) t
  CROSS JOIN LATERAL (
    SELECT jsonb_build_object('month', month_label, 'rate', rate) AS row_json
  ) j;

  -- 13. Assemble & Return
  v_result := jsonb_build_object(
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
      'avg_session_delta',       ROUND(COALESCE(v_avg_session, 0) - COALESCE(v_prev_avg_session, 0), 1)
    ),
    'enrollment_trend',  COALESCE(v_enrollment_trend,  '[]'::jsonb),
    'escalation_trend',  COALESCE(v_escalation_trend,  '[]'::jsonb),
    'feature_usage',     COALESCE(v_feature_usage,     '[]'::jsonb),
    'concern_themes',    COALESCE(v_concern_themes,    '[]'::jsonb),
    'checklist_trend',   COALESCE(v_checklist_trend,   '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_admin_dashboard(uuid) TO authenticated;
