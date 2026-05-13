-- ============================================================================
-- Migration: Add tenant_id to products for hospital resource scoping
-- Purpose: Enforce that hospital resources are only visible within their
--          associated tenant, preventing cross-tenant and generic leakage.
-- ============================================================================

-- Step 1: Add tenant_id column to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

-- Step 2: Backfill tenant_id from the expert's profile for hospital resources
UPDATE public.products p
SET tenant_id = pr.tenant_id
FROM public.profiles pr
WHERE p.expert_id = pr.id
  AND pr.tenant_id IS NOT NULL
  AND p.is_hospital_resource = true
  AND p.tenant_id IS NULL;

-- Step 3: Index for performance
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON public.products(tenant_id);

-- Step 4: Replace the overly permissive RLS policy with scoped ones

-- Drop existing policies that allow blanket visibility
DROP POLICY IF EXISTS "Products are viewable by everyone" ON products;

-- Authenticated users: see non-hospital products + their own tenant's hospital products
CREATE POLICY "Scoped product visibility" ON products
  FOR SELECT TO authenticated
  USING (
    status = 'published'
    AND (
      -- Non-hospital resources are always visible to all authenticated users
      is_hospital_resource IS NOT TRUE
      -- Hospital resources are visible only to users in the same tenant
      OR tenant_id IS NULL  -- legacy untagged hospital resources remain visible
      OR tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- Anon users: only see non-hospital published products
CREATE POLICY "Anon see public products" ON products
  FOR SELECT TO anon
  USING (
    status = 'published'
    AND is_hospital_resource IS NOT TRUE
  );
