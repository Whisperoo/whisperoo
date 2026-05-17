-- ============================================================================
-- Migration: Fix hospital resource leakage to B2C users
--
-- Problem: The previous "Scoped product visibility" policy included:
--            OR tenant_id IS NULL
--          This caused hospital resources uploaded by super admins (which have
--          is_hospital_resource = true but tenant_id = NULL because the admin's
--          profile has no tenant) to be visible to ALL users, including B2C
--          users with no hospital affiliation.
--
-- Fix: Remove the OR tenant_id IS NULL loophole. Hospital resources MUST have
--      a matching tenant_id to be visible. Resources without a tenant_id are
--      treated as untagged/orphaned and hidden from all regular users until
--      an admin assigns them to a tenant.
-- ============================================================================

-- Drop the leaking policy
DROP POLICY IF EXISTS "Scoped product visibility" ON products;

-- Re-create with strict hospital tenant matching
CREATE POLICY "Scoped product visibility" ON products
  FOR SELECT TO authenticated
  USING (
    status = 'published'
    AND (
      -- Non-hospital resources are visible to all authenticated users
      is_hospital_resource IS NOT TRUE
      -- Hospital resources are ONLY visible to users in the matching tenant
      OR (
        tenant_id IS NOT NULL
        AND tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
      )
    )
  );

-- Anon policy is unchanged — only non-hospital published products
DROP POLICY IF EXISTS "Anon see public products" ON products;
CREATE POLICY "Anon see public products" ON products
  FOR SELECT TO anon
  USING (
    status = 'published'
    AND is_hospital_resource IS NOT TRUE
  );
