-- Migration: Expert creation credentials + visibility defaults
-- 1) Add optional password parameter to fn_admin_create_expert for superadmin-created experts
-- 2) Default new experts to discoverable in patient-facing directories
-- 3) Backfill legacy experts with NULL visibility flags

DROP FUNCTION IF EXISTS public.fn_admin_create_expert(
  text, text, text, text, text[], text[], integer, numeric, text, numeric, uuid
);

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
  p_tenant_id uuid DEFAULT NULL,
  p_password text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_email text;
  v_caller_id uuid;
  v_is_admin boolean;
  v_user_id uuid;
  v_email text;
  v_password text;
BEGIN
  v_caller_email := (auth.jwt() ->> 'email');
  v_caller_id := auth.uid();

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_caller_id
      AND p.account_type IN ('admin', 'super_admin')
  ) INTO v_is_admin;

  IF NOT (
    v_caller_email IN ('engineering@whisperoo.app', 'sharab.khan101010@gmail.com')
    OR v_is_admin
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_email := COALESCE(NULLIF(TRIM(p_email), ''), 'expert-' || gen_random_uuid()::text || '@placeholder.whisperoo.app');
  v_password := COALESCE(NULLIF(TRIM(p_password), ''), 'expert-placeholder-' || gen_random_uuid()::text);

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
    extensions.crypt(v_password, extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('first_name', p_first_name),
    'authenticated',
    'authenticated',
    now(),
    now()
  );

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
    expert_profile_visibility = true,
    expert_accepts_new_clients = true,
    onboarded = true,
    tenant_id = p_tenant_id
  WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_admin_create_expert(
  text, text, text, text, text[], text[], integer, numeric, text, numeric, uuid, text
) TO authenticated;

-- Backfill existing experts so they appear for users by default
UPDATE public.profiles
SET expert_profile_visibility = true
WHERE account_type = 'expert' AND expert_profile_visibility IS NULL;

UPDATE public.profiles
SET expert_accepts_new_clients = true
WHERE account_type = 'expert' AND expert_accepts_new_clients IS NULL;

