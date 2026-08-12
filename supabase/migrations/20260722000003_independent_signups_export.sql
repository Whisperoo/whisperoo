-- "Independent / Unaffiliated Signups" export for the super admin Metrics
-- panel. There is currently no way to isolate tenant_id IS NULL users
-- anywhere in the admin panel: HospitalSelector's "All Hospitals" passes
-- p_tenant_id = NULL into every admin RPC, which is used as
-- "(p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)" — true for every
-- row — so "All Hospitals" actually means "no filter, everyone mixed
-- together," not "hospital tenants only" and definitely not "independents
-- only."
--
-- "Independent" is a proxy definition here (tenant_id IS NULL, onboarded),
-- not a captured intent signal — the onboarding "No, I'm independent"
-- option (OnboardingHospitalCheck.tsx) sets no field today. This also
-- catches pre-hospital-pilot signups and any signup from a period with
-- zero active tenants, which is an accepted imprecision for now.
--
-- Same RLS-visible-fields-only scope as fn_admin_qr_signup_export — no
-- auth.users join, no email. Single RPC serves both the on-load count and
-- the CSV export (returns full rows; caller uses list.length for the count).

CREATE OR REPLACE FUNCTION public.fn_admin_independent_signups_export(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  first_name text,
  phone text,
  acquisition_source text,
  created_at timestamptz
)
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

  RETURN QUERY
  SELECT
    p.first_name,
    p.phone_number AS phone,
    p.acquisition_source,
    p.created_at
  FROM public.profiles p
  WHERE p.onboarded = true
    AND p.tenant_id IS NULL
    AND (p_start_date IS NULL OR p.created_at::date >= p_start_date)
    AND (p_end_date IS NULL OR p.created_at::date <= p_end_date)
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_admin_independent_signups_export(date, date) TO authenticated;
