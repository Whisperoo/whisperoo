-- Phase 2 / B7 — Replace JWT email allowlists with staff role checks (account_type).
-- Uses SECURITY DEFINER helper so profiles RLS policies can gate on admin/super_admin
-- without self-referential recursion.
--
-- Also fixes RPCs that still referenced auth.users email-only gates or dropped profiles.email.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Helper: stable admin check (bypasses RLS when reading caller profile)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_caller_is_staff_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.account_type IN ('admin', 'super_admin', 'superadmin')
  );
$$;

REVOKE ALL ON FUNCTION public.fn_caller_is_staff_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_caller_is_staff_admin() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) RLS: profiles (super-admin tooling)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Super admin can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can view all profiles" ON public.profiles;

CREATE POLICY "Super admin can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.fn_caller_is_staff_admin());

CREATE POLICY "Super admin can update all profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.fn_caller_is_staff_admin())
  WITH CHECK (public.fn_caller_is_staff_admin());

CREATE POLICY "Super admin can delete profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.fn_caller_is_staff_admin());

CREATE POLICY "Super admin can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.fn_caller_is_staff_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) RLS: tenants / products (strip JWT email branch)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Super admin can insert tenants" ON public.tenants;
DROP POLICY IF EXISTS "Super admin can update tenants" ON public.tenants;

CREATE POLICY "Super admin can insert tenants"
  ON public.tenants FOR INSERT
  TO authenticated
  WITH CHECK (public.fn_caller_is_staff_admin());

CREATE POLICY "Super admin can update tenants"
  ON public.tenants FOR UPDATE
  TO authenticated
  USING (public.fn_caller_is_staff_admin())
  WITH CHECK (public.fn_caller_is_staff_admin());

DROP POLICY IF EXISTS "Super admin can insert products" ON public.products;
DROP POLICY IF EXISTS "Super admin can update products" ON public.products;
DROP POLICY IF EXISTS "Super admin can delete products" ON public.products;
DROP POLICY IF EXISTS "Super admin can view all products" ON public.products;

CREATE POLICY "Super admin can insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.fn_caller_is_staff_admin());

CREATE POLICY "Super admin can update products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.fn_caller_is_staff_admin())
  WITH CHECK (public.fn_caller_is_staff_admin());

CREATE POLICY "Super admin can delete products"
  ON public.products FOR DELETE
  TO authenticated
  USING (public.fn_caller_is_staff_admin());

CREATE POLICY "Super admin can view all products"
  ON public.products FOR SELECT
  TO authenticated
  USING (public.fn_caller_is_staff_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) RLS: discount_codes
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can manage discount codes" ON public.discount_codes;

CREATE POLICY "Admins can manage discount codes"
  ON public.discount_codes
  FOR ALL
  TO authenticated
  USING (public.fn_caller_is_staff_admin())
  WITH CHECK (public.fn_caller_is_staff_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Storage: expert-images bucket (admin tooling uploads)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can upload expert images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update expert images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete expert images" ON storage.objects;

CREATE POLICY "Admins can upload expert images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'expert-images'
    AND public.fn_caller_is_staff_admin()
  );

CREATE POLICY "Admins can update expert images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'expert-images'
    AND public.fn_caller_is_staff_admin()
  );

CREATE POLICY "Admins can delete expert images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'expert-images'
    AND public.fn_caller_is_staff_admin()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) RPC: resource utilization — staff admin only (no auth.users email gate)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_get_resource_utilization(
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
  v_result jsonb;
BEGIN
  IF NOT public.fn_caller_is_staff_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_agg(row_json)
  INTO v_result
  FROM (
    SELECT
      p.id as product_id,
      p.title,
      p.product_type,
      p.is_hospital_resource,
      COUNT(pu.id) as total_purchases,
      COALESCE(SUM(pu.amount), 0) as generated_revenue
    FROM products p
    LEFT JOIN purchases pu ON pu.product_id = p.id
      AND pu.status = 'completed'
      AND (p_start_date IS NULL OR pu.purchased_at::date >= p_start_date)
      AND (p_end_date IS NULL OR pu.purchased_at::date <= p_end_date)
    LEFT JOIN profiles prof ON prof.id = pu.user_id
    WHERE (p_tenant_id IS NULL OR prof.tenant_id = p_tenant_id OR prof.id IS NULL)
    GROUP BY p.id, p.title, p.product_type, p.is_hospital_resource
    ORDER BY total_purchases DESC
  ) t
  CROSS JOIN LATERAL (
    SELECT jsonb_build_object(
      'product_id', product_id,
      'title', title,
      'product_type', product_type,
      'is_hospital_resource', is_hospital_resource,
      'total_views', 0,
      'total_downloads', total_purchases,
      'total_saves', 0,
      'total_revenue', generated_revenue
    ) AS row_json
  ) j;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_resource_utilization(uuid, date, date) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) RPC: admin dashboard metrics — staff admin only
-- ─────────────────────────────────────────────────────────────────────────────

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
  v_60d_ago          timestamptz := now() - interval '60 days';
  v_6m_ago           timestamptz := now() - interval '6 months';

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

  v_enrollment_trend  jsonb;
  v_escalation_trend  jsonb;
  v_feature_usage     jsonb;
  v_concern_themes    jsonb;
  v_checklist_trend   jsonb;
  v_result            jsonb;

BEGIN
  IF NOT public.fn_caller_is_staff_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_effective_start := COALESCE(p_start_date::timestamptz, v_30d_ago);
  v_effective_end   := COALESCE(p_end_date::timestamptz + interval '1 day' - interval '1 microsecond', v_now);
  v_prev_start      := v_effective_start - (v_effective_end - v_effective_start);

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

  SELECT
    COUNT(*) FILTER (WHERE cp.completed = true),
    COUNT(*)
  INTO v_check_done, v_check_total
  FROM care_checklist_progress cp
  JOIN profiles p ON p.id = cp.user_id
  WHERE (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND cp.created_at >= v_effective_start AND cp.created_at <= v_effective_end;

  v_postpartum_pct := ROUND(v_check_done::numeric / NULLIF(v_check_total, 0) * 100, 1);

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

  SELECT COUNT(DISTINCT cp.user_id) INTO v_survey_users
  FROM care_checklist_progress cp
  JOIN profiles p ON p.id = cp.user_id
  WHERE cp.completed = true
    AND p.onboarded = true
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND cp.created_at >= v_effective_start AND cp.created_at <= v_effective_end;

  v_survey_pct := ROUND(v_survey_users::numeric / NULLIF(v_total_enrolled, 0) * 100, 1);

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
  WHERE ct.stage IN ('expecting_t1', 'reminder_prenatal_t1')
    AND cp.completed = true
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND cp.created_at >= v_effective_start AND cp.created_at <= v_effective_end;

  v_prenatal_pct := ROUND(v_prenatal_done::numeric / NULLIF(v_prenatal_total, 0) * 100, 1);

  SELECT COUNT(DISTINCT pu.id) INTO v_lactation_appts
  FROM purchases pu
  JOIN products pr ON pr.id = pu.product_id
  JOIN profiles  p ON  p.id = pu.user_id
  WHERE pr.product_type = 'consultation'
    AND pr.tags::text ILIKE '%lactation%'
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND pu.purchased_at >= v_effective_start AND pu.purchased_at <= v_effective_end;

  SELECT COUNT(*) INTO v_lactation_eng
  FROM purchases pu
  JOIN products pr ON pr.id = pu.product_id
  JOIN profiles p ON p.id = pu.user_id
  WHERE pr.tags::text ILIKE '%lactation%'
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND pu.purchased_at >= v_effective_start AND pu.purchased_at <= v_effective_end;

  SELECT COUNT(*) INTO v_hosp_res_eng
  FROM purchases pu
  JOIN products pr ON pr.id = pu.product_id
  JOIN profiles p ON p.id = pu.user_id
  WHERE pr.is_hospital_resource = true
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND pu.purchased_at >= v_effective_start AND pu.purchased_at <= v_effective_end;

  SELECT COUNT(*) INTO v_checklist_eng
  FROM care_checklist_progress cp
  JOIN profiles p ON p.id = cp.user_id
  WHERE cp.completed = true
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND cp.created_at >= v_effective_start AND cp.created_at <= v_effective_end;

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
      'avg_session_delta',       ROUND(COALESCE(v_avg_session, 0) - COALESCE(v_prev_avg_session, 0), 1),
      'lactation_appointments',  COALESCE(v_lactation_appts, 0),
      'lactation_engagement',    COALESCE(v_lactation_eng, 0),
      'hospital_resource_eng',   COALESCE(v_hosp_res_eng, 0),
      'checklist_engagement',    COALESCE(v_checklist_eng, 0)
    ),
    'enrollment_trend',  COALESCE((
      SELECT jsonb_agg(jsonb_build_object('month', m, 'count', c) ORDER BY m)
      FROM (
        SELECT to_char(p.created_at, 'YYYY-MM') AS m, COUNT(*) AS c
        FROM profiles p
        WHERE p.onboarded = true
          AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
          AND p.created_at >= v_6m_ago
        GROUP BY to_char(p.created_at, 'YYYY-MM')
      ) sub
    ), '[]'::jsonb),
    'escalation_trend',  COALESCE((
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
          AND msg.created_at >= v_6m_ago
        GROUP BY to_char(msg.created_at, 'YYYY-MM')
      ) sub
    ), '[]'::jsonb),
    'feature_usage',     COALESCE((
      SELECT jsonb_agg(jsonb_build_object('feature', f, 'count', c, 'pct', ROUND(c::numeric / NULLIF(v_total_enrolled, 0) * 100, 1)))
      FROM (
        SELECT 'AI Chat' AS f, COUNT(DISTINCT s.user_id) AS c
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
    'concern_themes',    '[]'::jsonb,
    'checklist_trend',   COALESCE((
      SELECT jsonb_agg(jsonb_build_object('month', m, 'rate', r) ORDER BY m)
      FROM (
        SELECT
          to_char(cp.created_at, 'YYYY-MM') AS m,
          ROUND(COUNT(*) FILTER (WHERE cp.completed = true)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS r
        FROM care_checklist_progress cp
        JOIN profiles p ON p.id = cp.user_id
        WHERE (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
          AND cp.created_at >= v_6m_ago
        GROUP BY to_char(cp.created_at, 'YYYY-MM')
      ) sub
    ), '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_admin_dashboard(uuid, date, date) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8) RPC: expert creation — staff admin only (no JWT email fallback)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_admin_create_expert(
  p_first_name text,
  p_email text DEFAULT NULL,
  p_profile_image_url text DEFAULT NULL,
  p_expert_bio text DEFAULT NULL,
  p_expert_specialties text[] DEFAULT '{}',
  p_expert_credentials text[] DEFAULT '{}',
  p_expert_experience_years integer DEFAULT 0,
  p_expert_consultation_rate numeric DEFAULT 0,
  p_expert_availability_status text DEFAULT 'available',
  p_expert_rating numeric DEFAULT 5.0,
  p_tenant_id uuid DEFAULT NULL,
  p_password text DEFAULT NULL,
  p_inquiry_confirmation_message text DEFAULT NULL,
  p_inquiry_prebook_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id uuid;
  v_is_admin boolean;
  v_user_id uuid;
  v_email text;
  v_password text;
BEGIN
  v_caller_id := auth.uid();

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_caller_id
      AND p.account_type IN ('admin', 'super_admin', 'superadmin')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_email := lower(COALESCE(NULLIF(TRIM(p_email), ''), 'expert-' || gen_random_uuid()::text || '@placeholder.whisperoo.app'));
  v_password := COALESCE(NULLIF(TRIM(p_password), ''), 'expert-placeholder-' || gen_random_uuid()::text);

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    v_email,
    extensions.crypt(v_password, extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('first_name', p_first_name),
    'authenticated',
    'authenticated',
    now(),
    now()
  );

  INSERT INTO public.profiles (id, first_name)
  VALUES (v_user_id, p_first_name)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.profiles SET
    first_name = p_first_name,
    profile_image_url = p_profile_image_url,
    expert_bio = p_expert_bio,
    expert_specialties = p_expert_specialties,
    expert_credentials = p_expert_credentials,
    expert_experience_years = p_expert_experience_years,
    expert_consultation_rate = p_expert_consultation_rate,
    expert_availability_status = p_expert_availability_status,
    expert_rating = p_expert_rating,
    account_type = 'expert',
    expert_verified = true,
    expert_profile_visibility = true,
    expert_accepts_new_clients = true,
    onboarded = true,
    tenant_id = p_tenant_id,
    inquiry_confirmation_message = p_inquiry_confirmation_message,
    inquiry_prebook_message = p_inquiry_prebook_message
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not created for expert user %', v_user_id;
  END IF;

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_admin_create_expert(
  text, text, text, text, text[], text[], integer, numeric, text, numeric, uuid, text, text, text
) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9) RPC: QR signup metrics — staff role only; omit profiles.email (column removed)
-- ─────────────────────────────────────────────────────────────────────────────

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
      WHERE (p_start_date IS NULL OR p.created_at::date >= p_start_date)
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
      WHERE p.signup_qr_code_id IS NULL
        AND p.acquisition_source = 'qr_hospital'
        AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
        AND (p_start_date IS NULL OR p.created_at::date >= p_start_date)
        AND (p_end_date IS NULL OR p.created_at::date <= p_end_date)
    )
    SELECT jsonb_build_object(
      'totals', jsonb_build_object(
        'scans', COALESCE((SELECT count(*) FROM ev JOIN qr ON qr.id = ev.qr_code_id WHERE ev.event_type = 'scan'), 0),
        'signups', COALESCE((SELECT cnt FROM attributed_signups), 0) + COALESCE((SELECT count(*) FROM unattributed), 0),
        'attributed_signups', COALESCE((SELECT cnt FROM attributed_signups), 0),
        'unattributed_signups', COALESCE((SELECT count(*) FROM unattributed), 0)
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

COMMIT;
