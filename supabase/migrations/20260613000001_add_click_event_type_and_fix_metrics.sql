-- Phase 1 + 2: Add 'click' event type and rebuild fn_get_resource_utilization
-- with the correct four metrics:
--
--   clicks    → user opened a resource they had NOT saved (discovery)
--   views     → user opened a resource FROM their saved/purchased content
--   saves     → user hit the Save button (product_wishlists)
--   downloads → user downloaded the actual PDF file
--
-- Metric sources:
--   clicks    → product_analytics WHERE event_type = 'click'
--   views     → product_analytics WHERE event_type = 'view'
--   saves     → product_wishlists
--   downloads → product_analytics WHERE event_type = 'download'
--              (not purchases — purchases = access granted, not file download)

-- ── 1. Extend event_type CHECK constraint to include 'click' ─────────────────

ALTER TABLE public.product_analytics
  DROP CONSTRAINT IF EXISTS product_analytics_event_type_check;

ALTER TABLE public.product_analytics
  ADD CONSTRAINT product_analytics_event_type_check
  CHECK (event_type IN ('view', 'preview', 'download', 'share', 'click'));

-- ── 2. Rebuild fn_get_resource_utilization ───────────────────────────────────

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
      p.id            AS product_id,
      p.title,
      p.product_type,
      p.is_hospital_resource,

      -- Clicks: opened but NOT yet saved (discovery events)
      COALESCE((
        SELECT COUNT(*)
        FROM public.product_analytics pa
        LEFT JOIN public.profiles vp ON vp.id = pa.user_id
        WHERE pa.product_id = p.id
          AND pa.event_type = 'click'
          AND (p_start_date IS NULL OR pa.created_at::date >= p_start_date)
          AND (p_end_date   IS NULL OR pa.created_at::date <= p_end_date)
          AND (p_tenant_id  IS NULL OR vp.tenant_id = p_tenant_id OR pa.user_id IS NULL)
      ), 0) AS total_clicks,

      -- Views: opened from saved/purchased content (engaged users)
      COALESCE((
        SELECT COUNT(*)
        FROM public.product_analytics pa
        LEFT JOIN public.profiles vp ON vp.id = pa.user_id
        WHERE pa.product_id = p.id
          AND pa.event_type = 'view'
          AND pa.session_id NOT LIKE 'backfill-%'
          AND (p_start_date IS NULL OR pa.created_at::date >= p_start_date)
          AND (p_end_date   IS NULL OR pa.created_at::date <= p_end_date)
          AND (p_tenant_id  IS NULL OR vp.tenant_id = p_tenant_id OR pa.user_id IS NULL)
      ), 0) AS total_views,

      -- Saves: wishlist saves
      COALESCE((
        SELECT COUNT(pw.id)
        FROM public.product_wishlists pw
        LEFT JOIN public.profiles sp ON sp.id = pw.user_id
        WHERE pw.product_id = p.id
          AND (p_start_date IS NULL OR pw.created_at::date >= p_start_date)
          AND (p_end_date   IS NULL OR pw.created_at::date <= p_end_date)
          AND (p_tenant_id  IS NULL OR sp.tenant_id = p_tenant_id)
      ), 0) AS total_saves,

      -- Downloads: actual PDF file downloads (not purchases/access grants)
      COALESCE((
        SELECT COUNT(*)
        FROM public.product_analytics pa
        LEFT JOIN public.profiles dp ON dp.id = pa.user_id
        WHERE pa.product_id = p.id
          AND pa.event_type = 'download'
          AND (p_start_date IS NULL OR pa.created_at::date >= p_start_date)
          AND (p_end_date   IS NULL OR pa.created_at::date <= p_end_date)
          AND (p_tenant_id  IS NULL OR dp.tenant_id = p_tenant_id OR pa.user_id IS NULL)
      ), 0) AS total_downloads,

      -- Revenue (kept for reference)
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
      'product_id',           product_id,
      'title',                title,
      'product_type',         product_type,
      'is_hospital_resource', is_hospital_resource,
      'total_clicks',         total_clicks,
      'total_views',          total_views,
      'total_saves',          total_saves,
      'total_downloads',      total_downloads,
      'total_revenue',        total_revenue
    ) AS row_json
  ) j;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_resource_utilization(uuid, date, date) TO authenticated;
