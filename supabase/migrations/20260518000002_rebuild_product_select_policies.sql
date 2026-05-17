-- ============================================================================
-- Migration: Rebuild all product SELECT/ALL policies from scratch
--
-- Problem: Multiple overlapping permissive SELECT policies accumulated across
-- migrations. In PostgreSQL, permissive policies combine with OR, so ANY
-- matching policy grants access. The tenant-scoping fix failed because older
-- FOR ALL policies (which include SELECT) were never dropped and could
-- still grant access via different conditions.
--
-- Policies being cleaned up:
--   "Products are viewable by everyone"       (original, status=published only)
--   "Experts can manage their own products"   (FOR ALL → includes SELECT)
--   "Admins can manage all products"          (FOR ALL → includes SELECT)
--   "Super admin can view all products"       (multiple versions)
--   "Scoped product visibility"               (our previous fix)
--   "Anon see public products"                (our previous fix)
-- ============================================================================

-- ── 1. Drop every policy that touches products SELECT ────────────────────────
DROP POLICY IF EXISTS "Products are viewable by everyone"       ON public.products;
DROP POLICY IF EXISTS "Experts can manage their own products"   ON public.products;
DROP POLICY IF EXISTS "Admins can manage all products"          ON public.products;
DROP POLICY IF EXISTS "Super admin can view all products"       ON public.products;
DROP POLICY IF EXISTS "Scoped product visibility"               ON public.products;
DROP POLICY IF EXISTS "Anon see public products"                ON public.products;

-- ── 2. Re-create expert self-management WITHOUT SELECT ───────────────────────
-- Experts can INSERT / UPDATE / DELETE their own products but their visibility
-- is governed by the SELECT policies below like any other user.
CREATE POLICY "Experts can manage their own products"
  ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = expert_id AND expert_id IS NOT NULL);

CREATE POLICY "Experts can update their own products"
  ON public.products
  FOR UPDATE TO authenticated
  USING (auth.uid() = expert_id AND expert_id IS NOT NULL)
  WITH CHECK (auth.uid() = expert_id AND expert_id IS NOT NULL);

CREATE POLICY "Experts can delete their own products"
  ON public.products
  FOR DELETE TO authenticated
  USING (auth.uid() = expert_id AND expert_id IS NOT NULL);

-- ── 3. Admin: full access (SELECT + write) ───────────────────────────────────
CREATE POLICY "Admins can manage all products"
  ON public.products
  FOR ALL TO authenticated
  USING (public.fn_caller_is_staff_admin())
  WITH CHECK (public.fn_caller_is_staff_admin());

-- ── 4. Authenticated users: scoped visibility ────────────────────────────────
-- Non-hospital resources: visible to all authenticated users.
-- Hospital resources: ONLY visible to users whose profile tenant_id matches
-- the product's tenant_id. B2C users (tenant_id IS NULL) never see hospital
-- resources. Hospital resources with no tenant_id are invisible to everyone
-- until an admin assigns them to a tenant.
CREATE POLICY "Scoped product visibility"
  ON public.products
  FOR SELECT TO authenticated
  USING (
    status = 'published'
    AND (
      is_hospital_resource IS NOT TRUE
      OR (
        tenant_id IS NOT NULL
        AND tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
      )
    )
  );

-- ── 5. Anon: non-hospital published products only ────────────────────────────
CREATE POLICY "Anon see public products"
  ON public.products
  FOR SELECT TO anon
  USING (
    status = 'published'
    AND is_hospital_resource IS NOT TRUE
  );
