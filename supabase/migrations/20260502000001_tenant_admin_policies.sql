-- Migration: Allow super admin to create and update tenants

-- Allow super admin to insert new tenants
CREATE POLICY "Super admin can insert tenants"
  ON public.tenants FOR INSERT
  WITH CHECK (
    (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('engineering@whisperoo.app')
  );

-- Allow super admin to update tenant config
CREATE POLICY "Super admin can update tenants"
  ON public.tenants FOR UPDATE
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('engineering@whisperoo.app')
  )
  WITH CHECK (
    (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('engineering@whisperoo.app')
  );
