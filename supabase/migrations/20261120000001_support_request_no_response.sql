-- Support Requests: "No response" status (client, 2026-11-20).
--
-- For parents who submitted a request but didn't reply when the team reached out.
-- Agreed with the client (option A): it is a CLOSED state, like 'done' —
--   - the parent's "We've got you" section disappears (fn_my_support_status)
--   - done_at records when it was closed, whichever way
--   - it sorts with Done at the bottom of the queue
-- The open count / attention badge (new + in_progress) is unchanged. Setting the
-- request back to 'in_progress' reopens it.
--
-- The functions below are copied unchanged from 20261003000001 / 20261031000003
-- except for the status lists.

ALTER TABLE public.support_requests DROP CONSTRAINT IF EXISTS support_requests_status_check;
ALTER TABLE public.support_requests ADD CONSTRAINT support_requests_status_check
  CHECK (status IN ('new', 'in_progress', 'done', 'no_response'));

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
  WHERE user_id = v_uid AND status NOT IN ('done', 'no_response')
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

CREATE OR REPLACE FUNCTION public.fn_admin_list_support_requests(
  p_status    text    DEFAULT 'open',   -- 'open' = new + in_progress, 'done', 'no_response', or 'all'
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
  ORDER BY (r.status IN ('done', 'no_response')), r.is_urgent DESC, r.created_at ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_list_support_requests(text, uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_list_support_requests(text, uuid, text, integer, integer) TO authenticated;

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
  IF p_status NOT IN ('new', 'in_progress', 'done', 'no_response') THEN
    RAISE EXCEPTION 'Invalid status %', p_status;
  END IF;

  UPDATE public.support_requests
     SET status     = p_status,
         handled_by = auth.uid(),
         done_at    = CASE WHEN p_status IN ('done', 'no_response') THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_set_support_request_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_set_support_request_status(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_set_support_request_status_bulk(p_ids uuid[], p_status text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.fn_caller_is_staff_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF p_status NOT IN ('new', 'in_progress', 'done', 'no_response') THEN
    RAISE EXCEPTION 'Invalid status %', p_status;
  END IF;
  IF p_ids IS NULL OR cardinality(p_ids) = 0 THEN
    RETURN 0;
  END IF;
  IF cardinality(p_ids) > 200 THEN
    RAISE EXCEPTION 'Too many requests in one bulk action (max 200)';
  END IF;

  UPDATE public.support_requests
     SET status     = p_status,
         handled_by = auth.uid(),
         done_at    = CASE WHEN p_status IN ('done', 'no_response') THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = ANY (p_ids) AND status <> p_status;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_set_support_request_status_bulk(uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_set_support_request_status_bulk(uuid[], text) TO authenticated;

-- ROLLBACK (manual): set any 'no_response' rows to 'done', restore the 3-value CHECK,
-- and re-run the four functions from 20261003000001 / 20261031000003.
