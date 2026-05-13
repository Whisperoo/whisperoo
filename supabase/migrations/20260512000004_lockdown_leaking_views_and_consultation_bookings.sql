-- 20260512000001_lockdown_leaking_views_and_consultation_bookings.sql
-- HIPAA Stage 1 (P0): Lock down leaking admin views + consultation_bookings.
-- Based on: "Whisperoo - Security / Compliance Review May 12 2026" (A1).

BEGIN;

-- 1) Revoke anon/authenticated access to exposed objects
REVOKE ALL ON public.flagged_messages_view FROM anon, authenticated;
REVOKE ALL ON public.admin_ai_audit_trail  FROM anon, authenticated;
REVOKE ALL ON public.tenant_user_details   FROM anon, authenticated;
REVOKE ALL ON public.consultation_bookings FROM anon;

-- 2) Ensure views run with invoker privileges so base-table RLS applies
-- (If a view is missing, skip without failing the migration.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'flagged_messages_view' AND relkind = 'v') THEN
    EXECUTE 'ALTER VIEW public.flagged_messages_view SET (security_invoker = on)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'admin_ai_audit_trail' AND relkind = 'v') THEN
    EXECUTE 'ALTER VIEW public.admin_ai_audit_trail SET (security_invoker = on)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'tenant_user_details' AND relkind = 'v') THEN
    EXECUTE 'ALTER VIEW public.tenant_user_details SET (security_invoker = on)';
  END IF;
END $$;

-- 3) Ensure consultation_bookings has RLS enabled (prod drift fix)
ALTER TABLE public.consultation_bookings ENABLE ROW LEVEL SECURITY;

-- 4) Ensure the "Users can view own bookings" policy exists for SELECT
DROP POLICY IF EXISTS "Users can view own bookings" ON public.consultation_bookings;
CREATE POLICY "Users can view own bookings"
ON public.consultation_bookings
FOR SELECT
USING (auth.uid() = user_id);

-- 5) Re-grant view SELECT to authenticated only.
-- With security_invoker on, RLS on base tables now applies.
GRANT SELECT ON public.flagged_messages_view, public.admin_ai_audit_trail, public.tenant_user_details TO authenticated;

COMMIT;

