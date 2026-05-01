-- Migration: Allow super admin to create and update tenants
-- Uses auth.jwt() instead of querying auth.users directly (which the authenticated role cannot access)

-- Drop old policies if they exist (from previous migration attempt)
DROP POLICY IF EXISTS "Super admin can insert tenants" ON public.tenants;
DROP POLICY IF EXISTS "Super admin can update tenants" ON public.tenants;

-- Allow super admin to insert new tenants
CREATE POLICY "Super admin can insert tenants"
  ON public.tenants FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'email') IN ('engineering@whisperoo.app')
  );

-- Allow super admin to update tenant config
CREATE POLICY "Super admin can update tenants"
  ON public.tenants FOR UPDATE
  USING (
    (auth.jwt() ->> 'email') IN ('engineering@whisperoo.app')
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') IN ('engineering@whisperoo.app')
  );
