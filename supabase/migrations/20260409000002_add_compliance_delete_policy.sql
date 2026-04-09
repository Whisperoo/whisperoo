-- 20260409000002_add_compliance_delete_policy.sql
CREATE POLICY "Enable delete for authenticated users" ON public.compliance_training FOR DELETE USING (true);
