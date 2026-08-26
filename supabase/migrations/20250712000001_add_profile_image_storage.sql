-- Migration: Add profile image storage and URL column
-- Date: 2025-07-12
-- Purpose: Add profile image functionality with Supabase storage bucket and URL column

-- Add profile_image_url column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN profile_image_url text;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.profile_image_url IS 'URL to user profile image stored in Supabase storage';

-- Create storage bucket for profile images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-images',
  'profile-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;   -- FIX (2026-08-26): was a bare INSERT, not re-runnable

-- FIX (2026-08-26): the statements below were bare ALTER/CREATE POLICY against
-- storage.objects and aborted the whole migration with:
--   ERROR: 42501: must be owner of table objects
-- storage.objects is owned by supabase_storage_admin, and the migration role
-- (postgres) is not a member of it — verified on the staging build. RLS is already
-- enabled on that table by Supabase's own defaults, so the ALTER is a no-op we are
-- simply not permitted to issue.
-- Rewritten to the fail-soft DO pattern already used by
-- 20260508000002_supabase_storage_expert_and_resources.sql, which documents this
-- same error. Behaviour is unchanged where privileges allow; where they do not, the
-- migration now emits a NOTICE and continues instead of aborting the entire push.
DO $$
BEGIN
  -- Ensure RLS is enabled (Supabase enables this by default)
  BEGIN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping: cannot ENABLE RLS on storage.objects (insufficient privilege).';
  END;

  BEGIN
    -- Policy: Users can view all profile images (public bucket)
    DROP POLICY IF EXISTS "Profile images are publicly viewable" ON storage.objects;
    CREATE POLICY "Profile images are publicly viewable" ON storage.objects
    FOR SELECT USING (bucket_id = 'profile-images');

    -- Policy: Users can upload their own profile images
    DROP POLICY IF EXISTS "Users can upload their own profile images" ON storage.objects;
    CREATE POLICY "Users can upload their own profile images" ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = 'profile-images'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );

    -- Policy: Users can update their own profile images
    DROP POLICY IF EXISTS "Users can update their own profile images" ON storage.objects;
    CREATE POLICY "Users can update their own profile images" ON storage.objects
    FOR UPDATE USING (
      bucket_id = 'profile-images'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );

    -- Policy: Users can delete their own profile images
    DROP POLICY IF EXISTS "Users can delete their own profile images" ON storage.objects;
    CREATE POLICY "Users can delete their own profile images" ON storage.objects
    FOR DELETE USING (
      bucket_id = 'profile-images'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping: cannot manage profile-images policies on storage.objects (insufficient privilege). Create them via the Supabase Storage dashboard.';
  END;
END $$;