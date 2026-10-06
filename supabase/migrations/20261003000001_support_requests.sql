-- =============================================================================
-- Get Support intake (Sprint 2 pivot; client request 2026-10-03, answers 2026-10-07)
--
-- A parent describes what they need in their own words. The team sources help
-- OFF-platform (no in-app matching) and follows up directly; the admin portal is
-- where they see requests and mark them done.
--
-- Write paths:
--   * Parent creates a request and saves the optional answers ONLY through the
--     `support-intake` edge function (service role), which runs the safety checks
--     (escalation keywords + OpenAI moderation) on every piece of free text and
--     sends the confirmation / team-alert messages. Parents get SELECT on their own
--     rows and nothing else.
--   * Staff admins work the queue through the fn_admin_* RPCs below.
--
-- HIPAA: request text is health information. The queue shows first name + the
-- request; contact details are only returned by fn_admin_support_request_contact,
-- which writes a phi_access_log row per call. The team alert email carries no
-- request content — just that a request exists and whether it is urgent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.support_requests (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id           uuid        REFERENCES public.tenants(id) ON DELETE SET NULL,
  request_text        text        NOT NULL CHECK (char_length(request_text) BETWEEN 1 AND 2000),
  topic               text,       -- specialty_categories.name, or 'General Parenting'
  answers             jsonb       NOT NULL DEFAULT '{}'::jsonb,
  empathy_reply       text,       -- what the parent was shown (AI or fixed crisis text)
  language            text        NOT NULL DEFAULT 'en',
  is_urgent           boolean     NOT NULL DEFAULT false,
  urgent_reason       text,
  status              text        NOT NULL DEFAULT 'new'
                                  CHECK (status IN ('new', 'in_progress', 'done')),
  handled_by          uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  done_at             timestamptz,
  -- Delivery record for the submit-time messages. NULL = not sent (provider not
  -- configured, no consent, or failed — see notify_log).
  parent_emailed_at   timestamptz,
  parent_texted_at    timestamptz,
  team_alerted_at     timestamptz,
  notify_log          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.support_requests IS
  'Get Support intake. Parent writes go through the support-intake edge function only; admins via fn_admin_* RPCs.';

CREATE INDEX IF NOT EXISTS idx_support_requests_user_created
  ON public.support_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_requests_queue
  ON public.support_requests (status, is_urgent DESC, created_at);

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_requests_select_own ON public.support_requests;
CREATE POLICY support_requests_select_own ON public.support_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS support_requests_select_staff ON public.support_requests;
CREATE POLICY support_requests_select_staff ON public.support_requests
  FOR SELECT TO authenticated
  USING (public.fn_caller_is_staff_admin());

REVOKE ALL ON public.support_requests FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.support_requests FROM authenticated;
GRANT SELECT ON public.support_requests TO authenticated;


-- -----------------------------------------------------------------------------
-- Shared: experts and resources a given caller is allowed to see.
-- Mirrors the app's own visibility rules: verified experts; hospital users only
-- see platform experts + their own hospital's, minus the tenant's hidden list;
-- products follow the "Scoped product visibility" policy, minus hidden products.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_support_visible_items(p_user_id uuid)
RETURNS TABLE (kind text, item_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT p.tenant_id,
           COALESCE(t.config, '{}'::jsonb) AS cfg
    FROM public.profiles p
    LEFT JOIN public.tenants t ON t.id = p.tenant_id
    WHERE p.id = p_user_id
  )
  SELECT 'expert', e.id
  FROM public.profiles e, me
  WHERE e.account_type = 'expert'
    AND e.expert_verified = true
    AND (e.tenant_id IS NULL OR e.tenant_id = me.tenant_id)
    AND NOT (e.id::text IN (SELECT jsonb_array_elements_text(COALESCE(me.cfg->'disabled_expert_ids', '[]'::jsonb))))
  UNION ALL
  SELECT 'product', pr.id
  FROM public.products pr, me
  WHERE pr.status = 'published'
    AND COALESCE(pr.is_active, true)
    AND (pr.is_hospital_resource IS NOT TRUE OR (pr.tenant_id IS NOT NULL AND pr.tenant_id = me.tenant_id))
    AND NOT (pr.id::text IN (SELECT jsonb_array_elements_text(COALESCE(me.cfg->'disabled_product_ids', '[]'::jsonb))));
$$;

REVOKE ALL ON FUNCTION public.fn_support_visible_items(uuid) FROM PUBLIC, anon, authenticated;


-- -----------------------------------------------------------------------------
-- Parent: their latest open request + suggestions for the status card:
-- 4 experts + 3 resources ranked by the request's topic. NULL when nothing is open.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_my_support_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_req       public.support_requests%ROWTYPE;
  v_lang      text;
  v_specs     text[];
  v_keywords  text[];
  v_experts   jsonb;
  v_products  jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_req
  FROM public.support_requests
  WHERE user_id = v_uid AND status <> 'done'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(language_preference, 'en') INTO v_lang FROM public.profiles WHERE id = v_uid;

  SELECT sc.mapped_specialties, sc.keywords
    INTO v_specs, v_keywords
  FROM public.specialty_categories sc
  WHERE sc.name = v_req.topic AND sc.is_active
  LIMIT 1;
  v_specs    := COALESCE(v_specs, '{}');
  v_keywords := COALESCE(v_keywords, '{}');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', r.id, 'name', r.first_name, 'image', r.profile_image_url,
           'role', r.expert_specialties[1]) ORDER BY r.overlap DESC, r.reviews DESC, r.first_name), '[]'::jsonb)
    INTO v_experts
  FROM (
    SELECT e.id, e.first_name, e.profile_image_url, e.expert_specialties,
           (SELECT count(*) FROM unnest(COALESCE(e.expert_specialties, '{}')) s
             WHERE lower(s) IN (SELECT lower(x) FROM unnest(v_specs) x)) AS overlap,
           COALESCE(e.expert_total_reviews, 0) AS reviews
    FROM public.profiles e
    JOIN public.fn_support_visible_items(v_uid) vis ON vis.kind = 'expert' AND vis.item_id = e.id
    ORDER BY overlap DESC, reviews DESC, e.first_name
    LIMIT 4
  ) r;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', r.id, 'title', r.title, 'product_type', r.product_type,
           'content_type', r.content_type, 'thumbnail', r.thumbnail_url,
           'expert_name', r.expert_name) ORDER BY r.score DESC, r.created_at DESC), '[]'::jsonb)
    INTO v_products
  FROM (
    SELECT pr.id,
           CASE v_lang WHEN 'es' THEN COALESCE(pr.title_es, pr.title)
                       WHEN 'vi' THEN COALESCE(pr.title_vi, pr.title)
                       ELSE pr.title END AS title,
           pr.product_type, pr.content_type, pr.thumbnail_url,
           ex.first_name AS expert_name,
           (CASE WHEN EXISTS (SELECT 1 FROM unnest(COALESCE(ex.expert_specialties, '{}')) s
                               WHERE lower(s) IN (SELECT lower(x) FROM unnest(v_specs) x)) THEN 2 ELSE 0 END
            + CASE WHEN EXISTS (SELECT 1 FROM unnest(COALESCE(pr.tags, '{}')) tg
                                 WHERE lower(tg) IN (SELECT lower(k) FROM unnest(v_keywords) k)) THEN 1 ELSE 0 END) AS score,
           pr.created_at
    FROM public.products pr
    JOIN public.fn_support_visible_items(v_uid) vis ON vis.kind = 'product' AND vis.item_id = pr.id
    LEFT JOIN public.profiles ex ON ex.id = pr.expert_id
    ORDER BY score DESC, pr.created_at DESC
    LIMIT 3
  ) r;

  RETURN jsonb_build_object(
    'id',            v_req.id,
    'status',        v_req.status,
    'topic',         v_req.topic,
    'request_text',  v_req.request_text,
    'answers',       v_req.answers,
    'empathy_reply', v_req.empathy_reply,
    'is_urgent',     v_req.is_urgent,
    'created_at',    v_req.created_at,
    'experts',       v_experts,
    'products',      v_products
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_my_support_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_my_support_status() TO authenticated;


-- -----------------------------------------------------------------------------
-- Admin: the queue. Urgent first, then oldest first (FIFO); done last.
-- No contact details here — see fn_admin_support_request_contact.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_admin_list_support_requests(
  p_status    text    DEFAULT 'open',   -- 'open' = new + in_progress, 'done', or 'all'
  p_tenant_id uuid    DEFAULT NULL,
  p_segment   text    DEFAULT 'all',
  p_limit     integer DEFAULT 50,
  p_offset    integer DEFAULT 0
)
RETURNS TABLE (
  id                uuid,
  user_id           uuid,
  first_name        text,
  tenant_name       text,
  topic             text,
  request_text      text,
  answers           jsonb,
  empathy_reply     text,
  language          text,
  is_urgent         boolean,
  urgent_reason     text,
  status            text,
  parent_emailed_at timestamptz,
  parent_texted_at  timestamptz,
  team_alerted_at   timestamptz,
  done_at           timestamptz,
  created_at        timestamptz,
  total_count       bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.fn_caller_is_staff_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT r.id, r.user_id, p.first_name, t.name, r.topic, r.request_text, r.answers,
         r.empathy_reply, r.language, r.is_urgent, r.urgent_reason, r.status,
         r.parent_emailed_at, r.parent_texted_at, r.team_alerted_at, r.done_at,
         r.created_at,
         count(*) OVER () AS total_count
  FROM public.support_requests r
  JOIN public.profiles p ON p.id = r.user_id
  LEFT JOIN public.tenants t ON t.id = r.tenant_id
  WHERE public.fn_profile_in_segment(r.tenant_id, COALESCE(p_segment, 'all'), p_tenant_id)
    AND (
      p_status = 'all'
      OR (p_status = 'open' AND r.status IN ('new', 'in_progress'))
      OR r.status = p_status
    )
  ORDER BY (r.status = 'done'), r.is_urgent DESC, r.created_at ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_list_support_requests(text, uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_list_support_requests(text, uuid, text, integer, integer) TO authenticated;


-- -----------------------------------------------------------------------------
-- Admin: move a request between new / in_progress / done.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_admin_set_support_request_status(p_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.fn_caller_is_staff_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF p_status NOT IN ('new', 'in_progress', 'done') THEN
    RAISE EXCEPTION 'Invalid status %', p_status;
  END IF;

  UPDATE public.support_requests
     SET status     = p_status,
         handled_by = auth.uid(),
         done_at    = CASE WHEN p_status = 'done' THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_set_support_request_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_set_support_request_status(uuid, text) TO authenticated;


-- -----------------------------------------------------------------------------
-- Admin: reveal the parent's contact details for one request. Audited.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_admin_support_request_contact(p_id uuid)
RETURNS TABLE (email text, phone text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_role text;
BEGIN
  IF NOT public.fn_caller_is_staff_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT r.user_id INTO v_user FROM public.support_requests r WHERE r.id = p_id;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  SELECT account_type INTO v_role FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.phi_access_log
    (accessor_user_id, accessor_role, patient_user_id, resource_type, resource_id, action, reason_code)
  VALUES
    (auth.uid(), v_role, v_user, 'support_request', p_id::text, 'view_contact', 'support_followup');

  RETURN QUERY
  SELECT u.email::text, p.phone_number::text
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE u.id = v_user;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_support_request_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_support_request_contact(uuid) TO authenticated;

-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.fn_admin_support_request_contact(uuid);
--   DROP FUNCTION IF EXISTS public.fn_admin_set_support_request_status(uuid, text);
--   DROP FUNCTION IF EXISTS public.fn_admin_list_support_requests(text, uuid, text, integer, integer);
--   DROP FUNCTION IF EXISTS public.fn_my_support_status();
--   DROP FUNCTION IF EXISTS public.fn_support_visible_items(uuid);
--   DROP TABLE IF EXISTS public.support_requests;
