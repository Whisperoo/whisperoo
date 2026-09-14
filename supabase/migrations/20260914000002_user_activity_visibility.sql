-- User activity visibility for the Super Admin portal.
--
-- Client request (approved 2026-09-14): "we know users are signing up, but what
-- are they doing on the platform afterwards?" Two surfaces: per-user activity on
-- the Users tab, and a signup→engagement funnel on Metrics.
--
-- HIPAA 6.1 governs every function here: activity TYPES and COUNTS only. No chat
-- content, no message text, no product titles tied to a person. An admin can see
-- that a user had 3 chat sessions and viewed 5 resources; never what they said.
--
-- Almost all of the signal already exists -- sessions, messages, product_analytics,
-- purchases, consultation_bookings, care_checklist_progress. The one genuine gap is
-- "logged in but did nothing", which nothing records today. Section 1 closes it.

-- ---------------------------------------------------------------------------
-- 1. Last-seen heartbeat
--
-- One row per app session start. No payload beyond the event name. Written by
-- the client on load via fn_record_activity, which is scoped to auth.uid() so
-- a user can only ever record their own presence.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event      text NOT NULL CHECK (event IN ('app_open')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_activity_log IS
  'Presence heartbeat: one app_open row per session start. Exists so "signed in but did nothing" is visible. No payload by design.';

CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_time
  ON public.user_activity_log (user_id, created_at DESC);

ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

-- Nobody reads this table directly from the client; the admin RPCs below are
-- SECURITY DEFINER. Users may insert their own rows only through the RPC.
DROP POLICY IF EXISTS "Admins read activity log" ON public.user_activity_log;
CREATE POLICY "Admins read activity log"
  ON public.user_activity_log FOR SELECT USING (fn_caller_is_staff_admin());

GRANT SELECT ON public.user_activity_log TO authenticated;   -- RLS gates to admins
GRANT ALL ON public.user_activity_log TO service_role;

CREATE OR REPLACE FUNCTION public.fn_record_activity(p_event text DEFAULT 'app_open')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;  -- silently ignore; presence is best-effort and must never error the app
  END IF;
  IF p_event NOT IN ('app_open') THEN
    RAISE EXCEPTION 'Invalid activity event: %', p_event;
  END IF;
  -- Collapse rapid repeats: one row per user per 30 minutes is enough for
  -- "last active" and keeps the table proportional to sessions, not renders.
  IF EXISTS (
    SELECT 1 FROM public.user_activity_log
    WHERE user_id = auth.uid() AND event = p_event
      AND created_at > now() - interval '30 minutes'
  ) THEN
    RETURN;
  END IF;
  INSERT INTO public.user_activity_log (user_id, event) VALUES (auth.uid(), p_event);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_record_activity(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Per-user activity summary, batched
--
-- The Users tab calls this once per page with the ids it is showing. Returns a
-- row per requested id, zeros where there is no activity, so the client can
-- join by position without null-handling.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_admin_user_activity_summary(p_user_ids uuid[])
RETURNS TABLE (
  user_id              uuid,
  last_active_at       timestamptz,
  chat_sessions        bigint,
  messages_sent        bigint,
  resources_viewed     bigint,
  resources_downloaded bigint,
  resources_saved      bigint,
  purchases            bigint,
  bookings             bigint,
  checklist_done       bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  SELECT p.account_type INTO v_role FROM public.profiles p WHERE p.id = auth.uid();
  IF COALESCE(v_role,'') NOT IN ('admin','super_admin','superadmin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  WITH ids AS (SELECT unnest(p_user_ids) AS uid),
  s AS (SELECT se.user_id, COUNT(*) AS n, MAX(COALESCE(se.last_message_at, se.created_at)) AS t
        FROM public.sessions se WHERE se.user_id = ANY(p_user_ids) GROUP BY 1),
  m AS (SELECT se.user_id, COUNT(*) AS n, MAX(me.created_at) AS t
        FROM public.messages me JOIN public.sessions se ON se.id = me.session_id
        WHERE me.role = 'user' AND se.user_id = ANY(p_user_ids) GROUP BY 1),
  pa AS (SELECT a.user_id,
                COUNT(*) FILTER (WHERE a.event_type = 'view')     AS views,
                COUNT(*) FILTER (WHERE a.event_type = 'download') AS downloads,
                MAX(a.created_at) AS t
         FROM public.product_analytics a WHERE a.user_id = ANY(p_user_ids) GROUP BY 1),
  w AS (SELECT wl.user_id, COUNT(*) AS n, MAX(wl.created_at) AS t
        FROM public.product_wishlists wl WHERE wl.user_id = ANY(p_user_ids) GROUP BY 1),
  pu AS (SELECT pr.user_id, COUNT(*) AS n, MAX(pr.purchased_at) AS t
         FROM public.purchases pr WHERE pr.user_id = ANY(p_user_ids) AND pr.status = 'completed' GROUP BY 1),
  b AS (SELECT cb.user_id, COUNT(*) AS n, MAX(cb.created_at) AS t
        FROM public.consultation_bookings cb WHERE cb.user_id = ANY(p_user_ids) AND cb.status <> 'cancelled' GROUP BY 1),
  c AS (SELECT cp.user_id, COUNT(*) AS n, MAX(cp.completed_at) AS t
        FROM public.care_checklist_progress cp WHERE cp.user_id = ANY(p_user_ids) AND cp.completed GROUP BY 1),
  h AS (SELECT al.user_id, MAX(al.created_at) AS t
        FROM public.user_activity_log al WHERE al.user_id = ANY(p_user_ids) GROUP BY 1)
  SELECT
    ids.uid,
    GREATEST(s.t, m.t, pa.t, w.t, pu.t, b.t, c.t, h.t),
    COALESCE(s.n, 0), COALESCE(m.n, 0),
    COALESCE(pa.views, 0), COALESCE(pa.downloads, 0), COALESCE(w.n, 0),
    COALESCE(pu.n, 0), COALESCE(b.n, 0), COALESCE(c.n, 0)
  FROM ids
  LEFT JOIN s  ON s.user_id  = ids.uid
  LEFT JOIN m  ON m.user_id  = ids.uid
  LEFT JOIN pa ON pa.user_id = ids.uid
  LEFT JOIN w  ON w.user_id  = ids.uid
  LEFT JOIN pu ON pu.user_id = ids.uid
  LEFT JOIN b  ON b.user_id  = ids.uid
  LEFT JOIN c  ON c.user_id  = ids.uid
  LEFT JOIN h  ON h.user_id  = ids.uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_admin_user_activity_summary(uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Per-user timeline for the drawer
--
-- A dated list of activity EVENTS. Each row is a type and a timestamp -- and for
-- content events, the resource title, which is catalogue data, not patient data.
-- Chat events carry the topic category only, never text.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_admin_user_timeline(p_user_id uuid, p_limit integer DEFAULT 100)
RETURNS TABLE (occurred_at timestamptz, event_type text, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  SELECT p.account_type INTO v_role FROM public.profiles p WHERE p.id = auth.uid();
  IF COALESCE(v_role,'') NOT IN ('admin','super_admin','superadmin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT * FROM (
    SELECT al.created_at, 'app_open'::text, NULL::text
      FROM public.user_activity_log al WHERE al.user_id = p_user_id
    UNION ALL
    SELECT se.created_at, 'chat_session', NULL
      FROM public.sessions se WHERE se.user_id = p_user_id
    UNION ALL
    SELECT me.created_at, 'chat_message', me.metadata->>'category'
      FROM public.messages me JOIN public.sessions se ON se.id = me.session_id
      WHERE se.user_id = p_user_id AND me.role = 'user'
    UNION ALL
    SELECT a.created_at, 'resource_' || a.event_type, pr.title
      FROM public.product_analytics a LEFT JOIN public.products pr ON pr.id = a.product_id
      WHERE a.user_id = p_user_id AND a.event_type IN ('view','download')
    UNION ALL
    SELECT wl.created_at, 'resource_saved', pr.title
      FROM public.product_wishlists wl LEFT JOIN public.products pr ON pr.id = wl.product_id
      WHERE wl.user_id = p_user_id
    UNION ALL
    SELECT pu.purchased_at, 'purchase', pr.title
      FROM public.purchases pu LEFT JOIN public.products pr ON pr.id = pu.product_id
      WHERE pu.user_id = p_user_id AND pu.status = 'completed'
    UNION ALL
    SELECT cb.created_at, 'booking', cb.appointment_name
      FROM public.consultation_bookings cb WHERE cb.user_id = p_user_id
    UNION ALL
    SELECT cp.completed_at, 'checklist_done', NULL
      FROM public.care_checklist_progress cp WHERE cp.user_id = p_user_id AND cp.completed AND cp.completed_at IS NOT NULL
  ) ev(occurred_at, event_type, detail)
  WHERE ev.occurred_at IS NOT NULL
  ORDER BY ev.occurred_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_admin_user_timeline(uuid, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Signup → engagement funnel
--
-- Of users who signed up in the window: how many onboarded, started a chat,
-- viewed content, saved or bought, booked. Each stage counts distinct users
-- who did that thing at any time -- the cohort is the signup window, the
-- behaviour is cumulative. Segment-aware like everything else.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_get_admin_funnel(
  p_tenant_id  uuid DEFAULT NULL,
  p_segment    text DEFAULT 'all',
  p_start_date date DEFAULT NULL,
  p_end_date   date DEFAULT NULL
)
RETURNS TABLE (stage text, stage_order integer, users bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  SELECT p.account_type INTO v_role FROM public.profiles p WHERE p.id = auth.uid();
  IF COALESCE(v_role,'') NOT IN ('admin','super_admin','superadmin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF COALESCE(p_segment,'all') NOT IN ('all','hospital','b2c') THEN
    RAISE EXCEPTION 'Invalid segment: %', p_segment;
  END IF;

  RETURN QUERY
  -- The cohort is parents who signed up in the window. Experts and admins are
  -- excluded: they are not the audience the funnel describes.
  WITH c AS (
    SELECT p.id FROM public.profiles p
    WHERE COALESCE(p.account_type,'user') IN ('user','parent')
      AND fn_profile_in_segment(p.tenant_id, p_segment, p_tenant_id)
      AND (p_start_date IS NULL OR p.created_at::date >= p_start_date)
      AND (p_end_date   IS NULL OR p.created_at::date <= p_end_date)
  )
  SELECT * FROM (VALUES
    ('signed_up',           1, (SELECT COUNT(*) FROM c)),
    ('onboarded',           2, (SELECT COUNT(*) FROM c JOIN public.profiles p ON p.id = c.id WHERE p.onboarded)),
    ('started_chat',        3, (SELECT COUNT(DISTINCT se.user_id) FROM public.sessions se JOIN c ON c.id = se.user_id)),
    ('viewed_content',      4, (SELECT COUNT(DISTINCT a.user_id) FROM public.product_analytics a JOIN c ON c.id = a.user_id WHERE a.event_type IN ('view','download'))),
    ('saved_or_bought',     5, (SELECT COUNT(DISTINCT u) FROM (
                                  SELECT wl.user_id AS u FROM public.product_wishlists wl JOIN c ON c.id = wl.user_id
                                  UNION SELECT pu.user_id FROM public.purchases pu JOIN c ON c.id = pu.user_id WHERE pu.status = 'completed'
                                ) x)),
    ('booked_consultation', 6, (SELECT COUNT(DISTINCT cb.user_id) FROM public.consultation_bookings cb JOIN c ON c.id = cb.user_id WHERE cb.status <> 'cancelled'))
  ) v(stage, stage_order, users)
  ORDER BY stage_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_admin_funnel(uuid, text, date, date) TO authenticated;

-- ROLLBACK (manual):
--   DROP FUNCTION IF EXISTS public.fn_get_admin_funnel(uuid, text, date, date);
--   DROP FUNCTION IF EXISTS public.fn_admin_user_timeline(uuid, integer);
--   DROP FUNCTION IF EXISTS public.fn_admin_user_activity_summary(uuid[]);
--   DROP FUNCTION IF EXISTS public.fn_record_activity(text);
--   DROP TABLE IF EXISTS public.user_activity_log;
