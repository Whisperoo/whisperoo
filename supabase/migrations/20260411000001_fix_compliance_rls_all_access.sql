-- Ensure ALL compliance_training entries are visible to ALL authenticated users
-- This fixes the issue where the Super Admin only sees their own entries

-- Drop existing SELECT policy and recreate with explicit all-access
DROP POLICY IF EXISTS "Enable read access for all users" ON public.compliance_training;
CREATE POLICY "compliance_read_all"
  ON public.compliance_training
  FOR SELECT
  TO authenticated
  USING (true);

-- Drop and recreate INSERT policy: any authenticated user can insert with their own tester_id
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.compliance_training;
CREATE POLICY "compliance_insert_own"
  ON public.compliance_training
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = tester_id);

-- Drop and recreate UPDATE policy: all authenticated users can update (for admin approval)
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.compliance_training;
CREATE POLICY "compliance_update_all"
  ON public.compliance_training
  FOR UPDATE
  TO authenticated
  USING (true);

-- Ensure DELETE policy exists (for admin rejection)
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.compliance_training;
CREATE POLICY "compliance_delete_all"
  ON public.compliance_training
  FOR DELETE
  TO authenticated
  USING (true);
