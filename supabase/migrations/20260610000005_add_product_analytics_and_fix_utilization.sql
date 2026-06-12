-- Add product_analytics table, backfill views from purchases, and wire real
-- views + saves into fn_get_resource_utilization.
--
-- Views backfill note: the product_analytics table never existed so all prior
-- view events were silently dropped. We backfill using purchases as a floor —
-- every user who purchased/claimed a product is a confirmed viewer. This
-- undercounts real views (people who browsed but didn't purchase are missing)
-- but is accurate for what we can prove from existing data.
--
-- Saves backfill: not needed — product_wishlists already holds all real saves.

-- ── 1. Create product_analytics ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.product_analytics (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id   uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type   text        NOT NULL CHECK (event_type IN ('view', 'preview', 'download', 'share')),
  session_id   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_analytics_product_event
  ON public.product_analytics (product_id, event_type);

CREATE INDEX IF NOT EXISTS idx_product_analytics_created_at
  ON public.product_analytics (created_at);

ALTER TABLE public.product_analytics ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own events (or anonymous events with null user_id)
CREATE POLICY "product_analytics_insert"
  ON public.product_analytics FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Users can read their own events
CREATE POLICY "product_analytics_select_own"
  ON public.product_analytics FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── 2. Backfill view events from purchases ────────────────────────────────────
-- One view event per completed purchase, timestamped at purchase time.
-- session_id prefixed with 'backfill-' so these are identifiable as synthetic.

INSERT INTO public.product_analytics (product_id, user_id, event_type, session_id, created_at)
SELECT
  pu.product_id,
  pu.user_id,
  'view',
  'backfill-' || pu.id::text,
  pu.purchased_at
FROM public.purchases pu
WHERE pu.status = 'completed';


-- ── 3. Update fn_get_resource_utilization ────────────────────────────────────
-- Now reads:
--   total_views     → product_analytics (event_type = 'view')
--   total_downloads → purchases (number of users who claimed/accessed the resource)
--   total_saves     → product_wishlists (users who bookmarked the resource)

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
  v_caller_role text;
  v_result      jsonb;
BEGIN
  SELECT account_type INTO v_caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF COALESCE(v_caller_role, '') NOT IN ('admin', 'super_admin', 'superadmin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_agg(row_json ORDER BY (row_json->>'total_views')::int DESC)
  INTO v_result
  FROM (
    SELECT
      p.id             AS product_id,
      p.title,
      p.product_type,
      p.is_hospital_resource,

      -- Views: counted from product_analytics, scoped to tenant if provided
      COALESCE((
        SELECT COUNT(*)
        FROM public.product_analytics pa
        LEFT JOIN public.profiles vp ON vp.id = pa.user_id
        WHERE pa.product_id = p.id
          AND pa.event_type = 'view'
          AND (p_start_date IS NULL OR pa.created_at::date >= p_start_date)
          AND (p_end_date   IS NULL OR pa.created_at::date <= p_end_date)
          AND (p_tenant_id  IS NULL OR vp.tenant_id = p_tenant_id OR pa.user_id IS NULL)
      ), 0) AS total_views,

      -- Downloads: purchases (claimed/accessed), scoped to tenant
      COALESCE((
        SELECT COUNT(pu.id)
        FROM public.purchases pu
        LEFT JOIN public.profiles dp ON dp.id = pu.user_id
        WHERE pu.product_id = p.id
          AND pu.status = 'completed'
          AND (p_start_date IS NULL OR pu.purchased_at::date >= p_start_date)
          AND (p_end_date   IS NULL OR pu.purchased_at::date <= p_end_date)
          AND (p_tenant_id  IS NULL OR dp.tenant_id = p_tenant_id)
      ), 0) AS total_downloads,

      -- Saves: wishlists, scoped to tenant
      COALESCE((
        SELECT COUNT(pw.id)
        FROM public.product_wishlists pw
        LEFT JOIN public.profiles sp ON sp.id = pw.user_id
        WHERE pw.product_id = p.id
          AND (p_start_date IS NULL OR pw.created_at::date >= p_start_date)
          AND (p_end_date   IS NULL OR pw.created_at::date <= p_end_date)
          AND (p_tenant_id  IS NULL OR sp.tenant_id = p_tenant_id)
      ), 0) AS total_saves,

      -- Revenue
      COALESCE((
        SELECT SUM(pu.amount)
        FROM public.purchases pu
        LEFT JOIN public.profiles rp ON rp.id = pu.user_id
        WHERE pu.product_id = p.id
          AND pu.status = 'completed'
          AND (p_start_date IS NULL OR pu.purchased_at::date >= p_start_date)
          AND (p_end_date   IS NULL OR pu.purchased_at::date <= p_end_date)
          AND (p_tenant_id  IS NULL OR rp.tenant_id = p_tenant_id)
      ), 0) AS total_revenue

    FROM public.products p
  ) t
  CROSS JOIN LATERAL (
    SELECT jsonb_build_object(
      'product_id',          product_id,
      'title',               title,
      'product_type',        product_type,
      'is_hospital_resource', is_hospital_resource,
      'total_views',         total_views,
      'total_downloads',     total_downloads,
      'total_saves',         total_saves,
      'total_revenue',       total_revenue
    ) AS row_json
  ) j;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_resource_utilization(uuid, date, date) TO authenticated;
