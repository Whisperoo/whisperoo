-- Migration: Fix Super Admin permissions for admin tooling
-- ======================================================
-- Problem:
-- - Admin tooling (experts/content/tenants) was gated by a single hardcoded email.
-- - UI allows more than one super admin, and we also want super_admin/admin account types to work.
--
-- Fix:
-- - Update RPC `fn_admin_create_expert` to authorize:
--   - allowlisted emails (backwards compatible), OR
--   - caller profile account_type in ('admin','super_admin')
-- - Update RLS policies for tenants/products/profiles used by admin panels.
--
-- NOTE:
-- - Policies on `profiles` avoid querying `profiles` to prevent RLS recursion.
-- - Policies on `products`/`tenants` can safely check caller's own profile row via auth.uid().

-- ────────────────────────────────────────────────────────────────
-- 1) RPC: fn_admin_create_expert (add admin/super_admin auth)
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_admin_create_expert(
  p_first_name text,
  p_email text DEFAULT NULL,
  p_profile_image_url text DEFAULT NULL,
  p_expert_bio text DEFAULT NULL,
  p_expert_specialties text[] DEFAULT '{}',
  p_expert_credentials text[] DEFAULT '{}',
  p_expert_experience_years integer DEFAULT 0,
  p_expert_consultation_rate numeric DEFAULT 0,
  p_expert_availability_status text DEFAULT 'available',
  p_expert_rating numeric DEFAULT 5.0,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_email text;
  v_caller_id uuid;
  v_is_admin boolean;
  v_user_id uuid;
  v_email text;
BEGIN
  v_caller_email := (auth.jwt() ->> 'email');
  v_caller_id := auth.uid();

  -- Authorize: either allowlisted emails OR caller has admin/super_admin account_type.
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_caller_id
      AND p.account_type IN ('admin', 'super_admin')
  ) INTO v_is_admin;

  IF NOT (
    v_caller_email IN ('engineering@whisperoo.app')
    OR v_is_admin
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Generate a unique placeholder email if none provided
  v_email := COALESCE(NULLIF(TRIM(p_email), ''), 'expert-' || gen_random_uuid()::text || '@placeholder.whisperoo.app');

  -- Create a placeholder auth user (generates the UUID we need for profiles.id FK)
  v_user_id := gen_random_uuid();
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    v_email,
    crypt('expert-placeholder-' || v_user_id::text, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('first_name', p_first_name),
    'authenticated',
    'authenticated',
    now(),
    now()
  );

  -- The trigger `on_auth_user_created` will auto-create the profile row.
  -- Now update it with expert fields and the tenant_id.
  UPDATE public.profiles SET
    first_name = p_first_name,
    email = v_email,
    profile_image_url = p_profile_image_url,
    expert_bio = p_expert_bio,
    expert_specialties = p_expert_specialties,
    expert_credentials = p_expert_credentials,
    expert_experience_years = p_expert_experience_years,
    expert_consultation_rate = p_expert_consultation_rate,
    expert_availability_status = p_expert_availability_status,
    expert_rating = p_expert_rating,
    account_type = 'expert',
    expert_verified = true,
    onboarded = true,
    tenant_id = p_tenant_id
  WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_admin_create_expert(
  text, text, text, text, text[], text[], integer, numeric, text, numeric, uuid
) TO authenticated;

-- ────────────────────────────────────────────────────────────────
-- 2) RLS Policies: Tenants (admin tooling)
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Super admin can insert tenants" ON public.tenants;
DROP POLICY IF EXISTS "Super admin can update tenants" ON public.tenants;

CREATE POLICY "Super admin can insert tenants"
  ON public.tenants FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'email') IN ('engineering@whisperoo.app')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Super admin can update tenants"
  ON public.tenants FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') IN ('engineering@whisperoo.app')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') IN ('engineering@whisperoo.app')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'super_admin')
    )
  );

-- ────────────────────────────────────────────────────────────────
-- 3) RLS Policies: Products (content management)
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Super admin can insert products" ON public.products;
DROP POLICY IF EXISTS "Super admin can update products" ON public.products;
DROP POLICY IF EXISTS "Super admin can delete products" ON public.products;
DROP POLICY IF EXISTS "Super admin can view all products" ON public.products;

CREATE POLICY "Super admin can insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'email') IN ('engineering@whisperoo.app')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Super admin can update products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') IN ('engineering@whisperoo.app')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') IN ('engineering@whisperoo.app')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Super admin can delete products"
  ON public.products FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') IN ('engineering@whisperoo.app')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Super admin can view all products"
  ON public.products FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') IN ('engineering@whisperoo.app')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('admin', 'super_admin')
    )
  );

-- ────────────────────────────────────────────────────────────────
-- 4) RLS Policies: Profiles (expert management)
--    Keep email-based gating here to avoid recursion.
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Super admin can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can view all profiles" ON public.profiles;

CREATE POLICY "Super admin can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') IN ('engineering@whisperoo.app'));

CREATE POLICY "Super admin can update all profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('engineering@whisperoo.app'))
  WITH CHECK ((auth.jwt() ->> 'email') IN ('engineering@whisperoo.app'));

CREATE POLICY "Super admin can delete profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('engineering@whisperoo.app'));

CREATE POLICY "Super admin can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'email') IN ('engineering@whisperoo.app'));

