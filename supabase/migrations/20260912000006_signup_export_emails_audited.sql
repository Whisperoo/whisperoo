-- CSV export fix: add the email address, through an audited path.
--
-- Sprint 2 (QUO-2026-004) workstream 1: "Resolve missing email address and phone
-- number fields in the existing CSV export." Phone was already present; email was
-- not, and cannot be added to the RPC directly -- profiles.email was deliberately
-- dropped in 20260504000001 (HIPAA), and the only copy lives in auth.users, which
-- PostgREST never exposes.
--
-- Design:
--
--   1. The two export RPCs gain `user_id` as their first column. They returned no
--      identifier at all, so there was nothing to join an email onto. Return-type
--      changes require DROP + CREATE; everything else in each body is unchanged
--      (generated from the live definitions).
--
--   2. fn_service_emails_for_users(uuid[]) reads auth.users for a list of ids. It
--      is executable by service_role ONLY -- explicitly revoked from authenticated
--      and anon -- so no browser session can ever call it, whatever its role. The
--      admin-signup-export edge function is the sole caller, and it writes a
--      phi_access_log row before returning anything.
--
-- The email therefore never travels through a path a client can reach directly,
-- and every export that includes it is on the access log with who, when, which
-- export, which filters and how many rows.

DROP FUNCTION IF EXISTS public.fn_admin_qr_signup_export(uuid, date, date);
DROP FUNCTION IF EXISTS public.fn_admin_independent_signups_export(date, date);

CREATE OR REPLACE FUNCTION public.fn_admin_qr_signup_export(p_tenant_id uuid DEFAULT NULL::uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS TABLE(user_id uuid, first_name text, phone text, tenant_name text, qr_label text, department text, acquisition_source text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    p.id AS user_id,
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
$function$;

CREATE OR REPLACE FUNCTION public.fn_admin_independent_signups_export(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS TABLE(user_id uuid, first_name text, phone text, acquisition_source text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    p.id AS user_id,
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
$function$;

-- ---------------------------------------------------------------------------
-- Service-only email lookup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_service_emails_for_users(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.email::text
  FROM auth.users u
  WHERE u.id = ANY (p_user_ids);
$$;

COMMENT ON FUNCTION public.fn_service_emails_for_users(uuid[]) IS
  'Service-role only. Resolves emails for the audited signup export. Never grant to authenticated.';

REVOKE ALL ON FUNCTION public.fn_service_emails_for_users(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_service_emails_for_users(uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.fn_service_emails_for_users(uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_service_emails_for_users(uuid[]) TO service_role;

-- Re-grant the recreated export RPCs to match what they had before the DROP.
GRANT EXECUTE ON FUNCTION public.fn_admin_qr_signup_export(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_admin_independent_signups_export(date, date) TO authenticated;

-- ROLLBACK: recreate the two RPCs without user_id from 20260716000003 /
-- 20260722000003, and DROP FUNCTION public.fn_service_emails_for_users(uuid[]).
