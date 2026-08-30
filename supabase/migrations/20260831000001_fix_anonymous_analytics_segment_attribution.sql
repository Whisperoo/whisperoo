-- Fix: anonymous product_analytics rows were counted as B2C.
--
-- 20260827000001 documented that rows with pa.user_id IS NULL are included only
-- under p_segment = 'all', so 'hospital' and 'b2c' partition cleanly and sum to
-- 'all'. The predicate it shipped does not achieve that.
--
-- fn_get_resource_utilization LEFT JOINs profiles onto product_analytics. For a row
-- with no user that join yields tenant_id = NULL -- and fn_profile_in_segment's
-- 'b2c' branch is exactly "tenant_id IS NULL", so it returns true. The
-- `OR (p_segment = 'all' AND pa.user_id IS NULL)` guard never got a chance to
-- matter for b2c, because the first operand had already matched.
--
-- Caught on staging with seeded data: 6 B2C views were reported where only 4 B2C
-- users had viewed anything, the extra 2 being anonymous rows. 'hospital' was never
-- affected -- its branch requires tenant_id IS NOT NULL, which a null join fails.
--
-- Corrected predicate, applied to both the views and the downloads subquery:
--
--   AND (fn_profile_in_segment(...) AND (pa.user_id IS NOT NULL OR p_segment = 'all'))
--
--   all      + anonymous  -> included (unchanged legacy behaviour)
--   b2c      + anonymous  -> excluded (was wrongly included)
--   hospital + anonymous  -> excluded (unchanged)
--   any segment + real user -> unchanged
--
-- Generated from the live definition; only those two predicates differ.

CREATE OR REPLACE FUNCTION public.fn_get_resource_utilization(p_tenant_id uuid DEFAULT NULL::uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_segment text DEFAULT 'all'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF COALESCE(p_segment, 'all') NOT IN ('all', 'hospital', 'b2c') THEN
    RAISE EXCEPTION 'Invalid segment: %. Expected all, hospital, or b2c.', p_segment;
  END IF;

  SELECT jsonb_agg(row_json ORDER BY (row_json->>'total_claims')::int DESC)
  INTO v_result
  FROM (
    SELECT
      p.id             AS product_id,
      p.title,
      p.product_type,
      p.is_hospital_resource,

      -- Claims: users who purchased / claimed access (was mislabeled "Downloads")
      COALESCE((
        SELECT COUNT(pu.id)
        FROM public.purchases pu
        LEFT JOIN public.profiles dp ON dp.id = pu.user_id
        WHERE pu.product_id = p.id
          AND pu.status = 'completed'
          AND (p_start_date IS NULL OR pu.purchased_at::date >= p_start_date)
          AND (p_end_date   IS NULL OR pu.purchased_at::date <= p_end_date)
          AND fn_profile_in_segment(dp.tenant_id, p_segment, p_tenant_id)
      ), 0) AS total_claims,

      -- Views: real opens from content viewer — excludes purchase-backfill rows
      COALESCE((
        SELECT COUNT(*)
        FROM public.product_analytics pa
        LEFT JOIN public.profiles vp ON vp.id = pa.user_id
        WHERE pa.product_id = p.id
          AND pa.event_type = 'view'
          AND (pa.session_id IS NULL OR pa.session_id NOT LIKE 'backfill-%')
          AND (p_start_date IS NULL OR pa.created_at::date >= p_start_date)
          AND (p_end_date   IS NULL OR pa.created_at::date <= p_end_date)
          AND (fn_profile_in_segment(vp.tenant_id, p_segment, p_tenant_id)
               AND (pa.user_id IS NOT NULL OR COALESCE(p_segment, 'all') = 'all'))
      ), 0) AS total_views,

      -- Downloads: actual PDF file downloads via the Download button
      COALESCE((
        SELECT COUNT(*)
        FROM public.product_analytics pa
        LEFT JOIN public.profiles dlp ON dlp.id = pa.user_id
        WHERE pa.product_id = p.id
          AND pa.event_type = 'download'
          AND (p_start_date IS NULL OR pa.created_at::date >= p_start_date)
          AND (p_end_date   IS NULL OR pa.created_at::date <= p_end_date)
          AND (fn_profile_in_segment(dlp.tenant_id, p_segment, p_tenant_id)
               AND (pa.user_id IS NOT NULL OR COALESCE(p_segment, 'all') = 'all'))
      ), 0) AS total_downloads,

      -- Saves: wishlist saves
      COALESCE((
        SELECT COUNT(pw.id)
        FROM public.product_wishlists pw
        LEFT JOIN public.profiles sp ON sp.id = pw.user_id
        WHERE pw.product_id = p.id
          AND (p_start_date IS NULL OR pw.created_at::date >= p_start_date)
          AND (p_end_date   IS NULL OR pw.created_at::date <= p_end_date)
          AND fn_profile_in_segment(sp.tenant_id, p_segment, p_tenant_id)
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
          AND fn_profile_in_segment(rp.tenant_id, p_segment, p_tenant_id)
      ), 0) AS total_revenue

    FROM public.products p
  ) t
  CROSS JOIN LATERAL (
    SELECT jsonb_build_object(
      'product_id',           product_id,
      'title',                title,
      'product_type',         product_type,
      'is_hospital_resource', is_hospital_resource,
      'total_claims',         total_claims,
      'total_views',          total_views,
      'total_downloads',      total_downloads,
      'total_saves',          total_saves,
      'total_revenue',        total_revenue
    ) AS row_json
  ) j;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$;
