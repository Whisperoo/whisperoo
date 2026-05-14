-- ==========================================================================
-- Fix: Enable tenant deletion from super admin panel
--
-- Two problems prevented delete from working:
--   1. No DELETE RLS policy existed on the tenants table (only INSERT/UPDATE).
--   2. profiles.tenant_id had a simple FK with no cascade — any tenant with
--      affiliated users would fail with a FK constraint violation.
--
-- Fix:
--   1. Add DELETE policy matching the existing super_admin pattern.
--   2. Re-create the FK with ON DELETE SET NULL so deleting a tenant just
--      nullifies tenant_id on affiliated profiles (users become B2C).
-- ==========================================================================

-- 1. Add DELETE policy for tenants
DROP POLICY IF EXISTS "Super admin can delete tenants" ON public.tenants;

CREATE POLICY "Super admin can delete tenants"
  ON public.tenants FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') IN ('engineering@whisperoo.app')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'super_admin')
    )
  );

-- 2. Re-create profiles.tenant_id FK with ON DELETE SET NULL.
--    This allows deleting a tenant even when users are still affiliated —
--    those users simply become B2C (tenant_id = NULL).
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_tenant_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tenant_id_fkey
    FOREIGN KEY (tenant_id)
    REFERENCES public.tenants(id)
    ON DELETE SET NULL;
