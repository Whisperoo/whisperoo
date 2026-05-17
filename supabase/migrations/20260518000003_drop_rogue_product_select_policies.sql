-- ============================================================================
-- Migration: Drop rogue product SELECT policies causing cross-tenant leakage
--
-- Root cause: These policies survived the previous cleanup because they had
-- different names than the ones we dropped. PostgreSQL permissive policies
-- combine with OR, so ANY matching policy grants access — these three were
-- overriding the strict "Scoped product visibility" policy:
--
--   "Public views active products"         → is_active = true (ANY user sees ALL products)
--   "Anyone can view consultation products"→ product_type=consultation AND is_active=true
--   "Experts view own products"            → auth.uid() = expert_id (bypasses tenant scoping)
--
-- Also cleans up duplicate write policies left by earlier migrations.
-- ============================================================================

-- ── Rogue SELECT policies (the actual security holes) ────────────────────────
DROP POLICY IF EXISTS "Public views active products"            ON public.products;
DROP POLICY IF EXISTS "Anyone can view consultation products"   ON public.products;
DROP POLICY IF EXISTS "Experts view own products"              ON public.products;

-- ── Duplicate write policies (harmless but messy) ────────────────────────────
DROP POLICY IF EXISTS "Experts delete own products"            ON public.products;
DROP POLICY IF EXISTS "Experts insert own products"            ON public.products;
DROP POLICY IF EXISTS "Experts update own products"            ON public.products;
DROP POLICY IF EXISTS "Admins can insert products"             ON public.products;
DROP POLICY IF EXISTS "Admins can update products"             ON public.products;
DROP POLICY IF EXISTS "Super admin can insert products"        ON public.products;
DROP POLICY IF EXISTS "Super admin can update products"        ON public.products;
DROP POLICY IF EXISTS "Super admin can delete products"        ON public.products;

-- After this migration, the only active SELECT policies on products are:
--   "Scoped product visibility"  → authenticated: non-hospital OR matching tenant_id
--   "Anon see public products"   → anon: non-hospital published only
-- Write access:
--   "Admins can manage all products"      → FOR ALL via fn_caller_is_staff_admin()
--   "Experts can manage their own products" → INSERT only, auth.uid() = expert_id
--   "Experts can update their own products" → UPDATE only
--   "Experts can delete their own products" → DELETE only
