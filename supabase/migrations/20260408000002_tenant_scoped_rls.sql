-- 20260408000002_tenant_scoped_rls.sql

-- Helper function to get current user's tenant_id (useful for broader cross-tenant policies)
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;
