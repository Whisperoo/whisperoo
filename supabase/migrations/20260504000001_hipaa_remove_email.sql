-- Migration: Remove email from public profiles for HIPAA compliance (Pseudonymization)

-- 1. Drop dependent views that reference the email column
DROP VIEW IF EXISTS public.flagged_messages_view CASCADE;
DROP VIEW IF EXISTS public.tenant_user_details CASCADE;

-- 2. Drop the index
DROP INDEX IF EXISTS idx_profiles_email;

-- 3. Update the trigger function so it stops trying to insert email
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, first_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Drop the email column
ALTER TABLE profiles DROP COLUMN IF EXISTS email;

-- 5. Recreate dependent views WITHOUT the email column

-- Recreate flagged_messages_view (pseudonymized)
CREATE VIEW public.flagged_messages_view AS
SELECT
  m.id,
  m.session_id,
  m.role,
  m.content,
  m.metadata,
  m.is_flagged_for_review,
  m.created_at,
  s.user_id,
  p.first_name AS user_name,
  p.tenant_id
FROM public.messages m
JOIN public.sessions s ON m.session_id = s.id
JOIN public.profiles p ON s.user_id = p.id
WHERE m.is_flagged_for_review = true
ORDER BY m.created_at DESC;

-- Recreate tenant_user_details (pseudonymized)
CREATE OR REPLACE VIEW public.tenant_user_details AS
SELECT
  p.id AS user_id,
  p.first_name,
  p.tenant_id,
  p.acquisition_source,
  p.acquisition_department,
  p.language_preference,
  p.role,
  p.onboarded,
  p.created_at,
  t.name AS tenant_name,
  t.slug AS tenant_slug
FROM public.profiles p
INNER JOIN public.tenants t ON p.tenant_id = t.id
WHERE p.tenant_id IS NOT NULL;
