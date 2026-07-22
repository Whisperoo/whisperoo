-- Per-signup row RPC for the "Export CSV" button in the QR Signup Attribution
-- panel. Aggregate RPC `fn_admin_qr_signup_metrics` returns totals only, so it
-- can't feed a row-level export.
--
-- RLS-visible fields only (no auth.users join) — email cannot be returned
-- here because profiles.email was dropped in HIPAA migration 20260504000001.
-- Pulling email would require an audited edge function; deliberately out of
-- scope for this export per product decision.
--
-- Auth gate matches fn_admin_qr_signup_metrics: admin/super_admin only.

CREATE OR REPLACE FUNCTION public.fn_admin_qr_signup_export(
  p_tenant_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  first_name text,
  phone text,
  tenant_name text,
  qr_label text,
  department text,
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
    t.name AS tenant_name,
    qc.label AS qr_label,
    COALESCE(p.acquisition_department, qc.department) AS department,
    p.acquisition_source,
    p.created_at
  FROM public.profiles p
  LEFT JOIN public.tenants t ON t.id = p.tenant_id
  LEFT JOIN public.qr_codes qc ON qc.id = p.signup_qr_code_id
  WHERE p.onboarded = true
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND (p_start_date IS NULL OR p.created_at::date >= p_start_date)
    AND (p_end_date IS NULL OR p.created_at::date <= p_end_date)
    AND (
      -- Attributed: signed up via a QR code
      p.signup_qr_code_id IS NOT NULL
      -- OR unattributed but flagged as qr_hospital source (same shape as fn_admin_qr_signup_metrics)
      OR (p.signup_qr_code_id IS NULL AND p.acquisition_source = 'qr_hospital')
    )
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_admin_qr_signup_export(uuid, date, date) TO authenticated;
