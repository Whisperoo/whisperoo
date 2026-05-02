-- Migration: Allow super admin CRUD on profiles (experts) and products (content)

-- ── Profiles (Expert management) ──────────────────────────────────

CREATE POLICY "Super admin can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'email') IN ('engineering@whisperoo.app'));

CREATE POLICY "Super admin can update all profiles"
  ON public.profiles FOR UPDATE
  USING ((auth.jwt() ->> 'email') IN ('engineering@whisperoo.app'))
  WITH CHECK ((auth.jwt() ->> 'email') IN ('engineering@whisperoo.app'));

CREATE POLICY "Super admin can delete profiles"
  ON public.profiles FOR DELETE
  USING ((auth.jwt() ->> 'email') IN ('engineering@whisperoo.app'));

-- ── Products (Content management) ─────────────────────────────────

CREATE POLICY "Super admin can insert products"
  ON public.products FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'email') IN ('engineering@whisperoo.app'));

CREATE POLICY "Super admin can update products"
  ON public.products FOR UPDATE
  USING ((auth.jwt() ->> 'email') IN ('engineering@whisperoo.app'))
  WITH CHECK ((auth.jwt() ->> 'email') IN ('engineering@whisperoo.app'));

CREATE POLICY "Super admin can delete products"
  ON public.products FOR DELETE
  USING ((auth.jwt() ->> 'email') IN ('engineering@whisperoo.app'));
