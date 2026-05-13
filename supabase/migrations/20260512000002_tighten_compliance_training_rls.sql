-- 20260512000002_tighten_compliance_training_rls.sql
-- HIPAA Stage 1 (P1): Tighten compliance_training RLS (B5).
-- Goal: Only admin/super_admin can read/update/delete; authenticated can insert own.

BEGIN;

DROP POLICY IF EXISTS compliance_read_all   ON public.compliance_training;
DROP POLICY IF EXISTS compliance_update_all ON public.compliance_training;
DROP POLICY IF EXISTS compliance_delete_all ON public.compliance_training;

CREATE POLICY "compliance_admin_read"
ON public.compliance_training
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND account_type IN ('admin','super_admin')
  )
);

CREATE POLICY "compliance_admin_update"
ON public.compliance_training
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND account_type IN ('admin','super_admin')
  )
);

CREATE POLICY "compliance_admin_delete"
ON public.compliance_training
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND account_type IN ('admin','super_admin')
  )
);

COMMIT;

