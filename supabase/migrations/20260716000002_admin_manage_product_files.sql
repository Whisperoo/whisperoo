-- Admins had no explicit RLS policy on product_files — only
-- "Experts can manage their product files" (scoped to products.expert_id =
-- auth.uid()) and a service-role-only policy existed. AdminProductForm.tsx
-- always assigns a *different* expert as the content author, so every
-- admin insert/update/delete against product_files was being silently
-- rejected by RLS (the app itself never checked the returned error — see
-- the accompanying frontend fix in AdminProductForm.tsx).
--
-- Mirrors the existing "Admins can manage all products" policy on `products`.

DROP POLICY IF EXISTS "Admins can manage all product files" ON public.product_files;
CREATE POLICY "Admins can manage all product files" ON public.product_files
  FOR ALL USING (fn_caller_is_staff_admin()) WITH CHECK (fn_caller_is_staff_admin());
