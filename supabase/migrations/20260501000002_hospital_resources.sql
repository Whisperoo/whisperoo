-- Migration: Add hospital resources tracking and utilization metrics

-- 1. Add column to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_hospital_resource boolean DEFAULT false;

-- 2. Create fn_get_resource_utilization
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
  -- Super-admin only
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) NOT IN ('engineering@whisperoo.app') THEN
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
      COALESCE(SUM(CASE WHEN pa.event_type = 'view' THEN 1 ELSE 0 END), 0) as views,
      COALESCE(SUM(CASE WHEN pa.event_type = 'download' THEN 1 ELSE 0 END), 0) as downloads,
      COALESCE(SUM(CASE WHEN pa.event_type = 'preview' THEN 1 ELSE 0 END), 0) as previews,
      (SELECT COUNT(*) FROM purchases pu JOIN profiles pf ON pf.id = pu.user_id WHERE pu.product_id = p.id AND (p_tenant_id IS NULL OR pf.tenant_id = p_tenant_id) AND (p_start_date IS NULL OR pu.created_at::date >= p_start_date) AND (p_end_date IS NULL OR pu.created_at::date <= p_end_date)) as purchases,
      (SELECT COALESCE(SUM(p.price), 0) FROM purchases pu JOIN profiles pf ON pf.id = pu.user_id WHERE pu.product_id = p.id AND (p_tenant_id IS NULL OR pf.tenant_id = p_tenant_id) AND (p_start_date IS NULL OR pu.created_at::date >= p_start_date) AND (p_end_date IS NULL OR pu.created_at::date <= p_end_date)) as generated_revenue
    FROM products p
    LEFT JOIN product_analytics pa ON pa.product_id = p.id
    LEFT JOIN profiles prof ON prof.id = pa.user_id
    WHERE (p_tenant_id IS NULL OR prof.tenant_id = p_tenant_id OR prof.id IS NULL)
      AND (p_start_date IS NULL OR pa.created_at::date >= p_start_date)
      AND (p_end_date IS NULL OR pa.created_at::date <= p_end_date)
    GROUP BY p.id, p.title, p.product_type, p.is_hospital_resource
    ORDER BY views DESC
  ) t
  CROSS JOIN LATERAL (
    SELECT jsonb_build_object(
      'product_id', product_id,
      'title', title,
      'product_type', product_type,
      'is_hospital_resource', is_hospital_resource,
      'views', views,
      'downloads', downloads,
      'previews', previews,
      'purchases', purchases,
      'generated_revenue', generated_revenue
    ) AS row_json
  ) j;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_resource_utilization(uuid, date, date) TO authenticated;
