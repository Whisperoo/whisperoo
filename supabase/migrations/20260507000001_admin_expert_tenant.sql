-- Migration: Add tenant_id to fn_admin_create_expert
-- This allows superadmins to create experts assigned to specific hospitals.

DROP FUNCTION IF EXISTS public.fn_admin_create_expert(text, text, text, text, text[], text[], integer, numeric, text, numeric);

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
  v_user_id uuid;
  v_email text;
BEGIN
  -- Only allow super admin
  v_caller_email := (auth.jwt() ->> 'email');
  IF v_caller_email NOT IN ('engineering@whisperoo.app') THEN
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
  UPDATE profiles SET
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

GRANT EXECUTE ON FUNCTION public.fn_admin_create_expert(text, text, text, text, text[], text[], integer, numeric, text, numeric, uuid) TO authenticated;
