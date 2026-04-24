-- =============================================================
-- 20260424000001_admin_dashboard_views.sql
-- Super Admin Hospital Dashboard — Views, Indexes, and RPC
-- =============================================================

-- ── 1. AI Audit Trail View ────────────────────────────────────
-- Gives the super-admin a flat, searchable view of every user
-- message, enriched with cohort (acquisition_source) and category.
-- SECURITY DEFINER so it bypasses per-user RLS for admin queries.
CREATE OR REPLACE VIEW public.admin_ai_audit_trail AS
SELECT
  m.id                                                      AS message_id,
  m.created_at,
  s.user_id,
  p.first_name                                              AS user_name,
  p.tenant_id,
  -- Cohort derived from acquisition_source (e.g. "PRE-2026-Q2" → "COHORT-PRE-2026-Q2")
  CASE
    WHEN p.acquisition_source IS NOT NULL
      THEN 'COHORT-' || UPPER(p.acquisition_source)
    ELSE 'COHORT-GENERAL'
  END                                                       AS cohort,
  -- Category written by edge function into messages.metadata
  COALESCE(m.metadata->>'category', 'General Parenting')   AS category,
  -- Truncated content as summary
  LEFT(m.content, 150)                                      AS summary,
  m.is_flagged_for_review                                   AS escalation,
  m.metadata
FROM public.messages m
JOIN public.sessions  s ON s.id = m.session_id
JOIN public.profiles  p ON p.id = s.user_id
WHERE m.role = 'user'
ORDER BY m.created_at DESC;

-- ── 2. Monthly Enrollment Trend View ─────────────────────────
CREATE OR REPLACE VIEW public.admin_monthly_enrollment AS
SELECT
  p.tenant_id,
  DATE_TRUNC('month', p.created_at)                        AS month_date,
  TO_CHAR(DATE_TRUNC('month', p.created_at), 'Mon')        AS month_label,
  COUNT(*)                                                  AS enrolled_count
FROM public.profiles p
WHERE p.onboarded = true
GROUP BY p.tenant_id, DATE_TRUNC('month', p.created_at);

-- ── 3. Monthly Escalation Trend View ─────────────────────────
CREATE OR REPLACE VIEW public.admin_monthly_escalation AS
SELECT
  p.tenant_id,
  DATE_TRUNC('month', m.created_at)                        AS month_date,
  TO_CHAR(DATE_TRUNC('month', m.created_at), 'Mon')        AS month_label,
  COUNT(*)                                                  AS total_messages,
  COUNT(*) FILTER (WHERE m.is_flagged_for_review = true)   AS flagged_count,
  ROUND(
    COUNT(*) FILTER (WHERE m.is_flagged_for_review = true)::numeric
    / NULLIF(COUNT(*), 0) * 100, 1
  )                                                         AS escalation_pct
FROM public.messages m
JOIN public.sessions  s ON s.id = m.session_id
JOIN public.profiles  p ON p.id = s.user_id
WHERE m.role = 'user'
GROUP BY p.tenant_id, DATE_TRUNC('month', m.created_at);

-- ── 4. Main Dashboard RPC ────────────────────────────────────
-- Returns all KPI data as a single JSON blob.
-- p_tenant_id = NULL  → aggregate across ALL tenants (All Hospitals)
-- p_tenant_id = <uuid> → scoped to a single tenant
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

  -- Enrollment
  v_total_enrolled   int;
  v_prev_enrolled    int;
  v_enrolled_delta   numeric;

  -- Escalation
  v_flagged_curr     int;
  v_msgs_curr        int;
  v_flagged_prev     int;
  v_msgs_prev        int;
  v_escal_pct        numeric;
  v_escal_prev_pct   numeric;
  v_escal_delta      numeric;

  -- Resources
  v_free_users       int;
  v_paid_users       int;
  v_consult_users    int;

  -- Checklist
  v_check_done       int;
  v_check_total      int;
  v_postpartum_pct   numeric;

  -- Usage
  v_dau              int;
  v_mau              int;
  v_prev_dau         int;
  v_prev_mau         int;
  v_avg_session      numeric;
  v_prev_avg_session numeric;

  -- JSON outputs
  v_enrollment_trend jsonb;
  v_escalation_trend jsonb;
  v_feature_usage    jsonb;
  v_concern_themes   jsonb;
  v_result           jsonb;
BEGIN

  -- ── Guard: only allow super-admin email ──────────────────────
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) NOT IN
     ('engineering@whisperoo.app')
  THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- ── 1. Total Enrolled ────────────────────────────────────────
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

  -- ── 2. Escalation Signals (current 30 days) ──────────────────
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

  -- Previous 30 days
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

  -- ── 3. Resource Metrics ───────────────────────────────────────
  SELECT COUNT(DISTINCT pu.user_id) INTO v_free_users
  FROM purchases pu JOIN profiles p ON p.id = pu.user_id
  WHERE pu.amount = 0 AND pu.status = 'completed'
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  SELECT COUNT(DISTINCT pu.user_id) INTO v_paid_users
  FROM purchases pu JOIN profiles p ON p.id = pu.user_id
  WHERE pu.amount > 0 AND pu.status = 'completed'
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  SELECT COUNT(DISTINCT pu.user_id) INTO v_consult_users
  FROM purchases pu
  JOIN products   pr ON pr.id = pu.product_id
  JOIN profiles    p ON  p.id = pu.user_id
  WHERE pr.product_type = 'consultation' AND pu.status = 'completed'
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  -- ── 4. Postpartum (Checklist completion rate) ─────────────────
  SELECT
    COUNT(*) FILTER (WHERE cp.completed = true),
    COUNT(*)
  INTO v_check_done, v_check_total
  FROM care_checklist_progress cp
  JOIN profiles p ON p.id = cp.user_id
  WHERE (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  v_postpartum_pct := ROUND(v_check_done::numeric / NULLIF(v_check_total, 0) * 100, 1);

  -- ── 5. DAU / MAU / Avg Session Duration ──────────────────────
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

  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (s.updated_at - s.created_at)) / 60)::numeric, 1)
  INTO v_avg_session
  FROM sessions s JOIN profiles p ON p.id = s.user_id
  WHERE s.updated_at IS NOT NULL AND s.created_at >= v_30d_ago
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (s.updated_at - s.created_at)) / 60)::numeric, 1)
  INTO v_prev_avg_session
  FROM sessions s JOIN profiles p ON p.id = s.user_id
  WHERE s.updated_at IS NOT NULL
    AND s.created_at >= v_60d_ago AND s.created_at < v_30d_ago
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id);

  -- ── 6. Enrollment Trend (last 6 months) ──────────────────────
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

  -- ── 7. Escalation Trend (last 6 months) ──────────────────────
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

  -- ── 8. Feature Usage Breakdown ────────────────────────────────
  SELECT jsonb_agg(row_json ORDER BY cnt DESC)
  INTO v_feature_usage
  FROM (
    SELECT 'AI Chat'         AS feature,
           COUNT(*)          AS cnt
    FROM messages m
    JOIN sessions s ON s.id = m.session_id
    JOIN profiles p ON p.id = s.user_id
    WHERE m.role = 'user'
      AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    UNION ALL
    SELECT 'Resource Visits', COUNT(DISTINCT pu.id)
    FROM purchases pu
    JOIN products   pr ON pr.id = pu.product_id
    JOIN profiles    p ON  p.id = pu.user_id
    WHERE pr.product_type != 'consultation' AND pu.amount = 0
      AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    UNION ALL
    SELECT 'Expert Booking', COUNT(DISTINCT pu.id)
    FROM purchases pu
    JOIN products   pr ON pr.id = pu.product_id
    JOIN profiles    p ON  p.id = pu.user_id
    WHERE pr.product_type = 'consultation'
      AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    UNION ALL
    SELECT 'Services', COUNT(*)
    FROM care_checklist_progress cp
    JOIN profiles p ON p.id = cp.user_id
    WHERE (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
  ) counts
  CROSS JOIN LATERAL (
    SELECT jsonb_build_object(
      'feature', feature,
      'count',   cnt,
      'pct', ROUND(cnt::numeric / NULLIF(
        (SELECT SUM(sub.cnt) FROM (
          SELECT COUNT(*) AS cnt FROM messages m2
          JOIN sessions s2 ON s2.id = m2.session_id
          JOIN profiles p2 ON p2.id = s2.user_id
          WHERE m2.role = 'user'
            AND (p_tenant_id IS NULL OR p2.tenant_id = p_tenant_id)
          UNION ALL
          SELECT COUNT(*) FROM purchases pu2
          JOIN profiles p2 ON p2.id = pu2.user_id
          WHERE (p_tenant_id IS NULL OR p2.tenant_id = p_tenant_id)
          UNION ALL
          SELECT COUNT(*) FROM care_checklist_progress cp2
          JOIN profiles p2 ON p2.id = cp2.user_id
          WHERE (p_tenant_id IS NULL OR p2.tenant_id = p_tenant_id)
        ) sub), 0) * 100, 1)
    ) AS row_json
  ) j;

  -- ── 9. Common Concern Themes ──────────────────────────────────
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

  -- ── 10. Assemble & Return ─────────────────────────────────────
  v_result := jsonb_build_object(
    'kpis', jsonb_build_object(
      -- Enrollment
      'total_enrolled',          v_total_enrolled,
      'total_enrolled_delta',    v_enrolled_delta,
      -- Escalation
      'escalation_pct',          COALESCE(v_escal_pct, 0),
      'escalation_delta',        v_escal_delta,
      -- Resources (as % of enrolled base)
      'free_resources_pct',      ROUND(v_free_users::numeric  / NULLIF(v_total_enrolled, 0) * 100, 1),
      'resources_purchased_pct', ROUND(v_paid_users::numeric  / NULLIF(v_total_enrolled, 0) * 100, 1),
      'expert_support_pct',      ROUND(v_consult_users::numeric / NULLIF(v_total_enrolled, 0) * 100, 1),
      -- Scaffolded placeholders (null = show "—" in UI)
      'survey_completion_pct',   NULL,
      'phreesia_risk_pct',       NULL,
      -- Postpartum
      'postpartum_visits_pct',   v_postpartum_pct,
      -- Usage
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
    'concern_themes',    COALESCE(v_concern_themes,    '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;

-- Grant execute only to authenticated users (auth guard inside function)
GRANT EXECUTE ON FUNCTION public.fn_get_admin_dashboard(uuid) TO authenticated;
