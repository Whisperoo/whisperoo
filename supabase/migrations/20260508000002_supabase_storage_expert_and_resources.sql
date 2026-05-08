-- 20260508000002_supabase_storage_expert_and_resources.sql
-- Purpose: allow admin uploads for expert images and hospital resources

-- Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('expert-images', 'expert-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('resource-files', 'resource-files', true, 52428800, ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'image/jpeg','image/png','image/webp'
  ]),
  ('resource-thumbnails', 'resource-thumbnails', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Policies on storage.objects sometimes fail in the Supabase SQL editor with:
--   ERROR: 42501: must be owner of table objects
-- To keep this migration resilient, we apply storage RLS/policies in a fail-soft DO block.
-- When applied via `supabase db push` (recommended), this block should succeed.
DO $$
BEGIN
  -- Ensure RLS is enabled
  BEGIN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping: cannot ENABLE RLS on storage.objects (insufficient privilege).';
  END;

  -- Public read access for these buckets
  BEGIN
    DROP POLICY IF EXISTS "Expert images are publicly viewable" ON storage.objects;
    CREATE POLICY "Expert images are publicly viewable"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'expert-images');

    DROP POLICY IF EXISTS "Resource files are publicly viewable" ON storage.objects;
    CREATE POLICY "Resource files are publicly viewable"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'resource-files');

    DROP POLICY IF EXISTS "Resource thumbnails are publicly viewable" ON storage.objects;
    CREATE POLICY "Resource thumbnails are publicly viewable"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'resource-thumbnails');
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping: cannot create public SELECT policies on storage.objects (insufficient privilege).';
  END;

  -- Admin write access (super_admin/admin)
  BEGIN
    DROP POLICY IF EXISTS "Admins can upload expert images" ON storage.objects;
    CREATE POLICY "Admins can upload expert images"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'expert-images'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.account_type IN ('admin','super_admin')
        )
      );

    DROP POLICY IF EXISTS "Admins can update expert images" ON storage.objects;
    CREATE POLICY "Admins can update expert images"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'expert-images'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.account_type IN ('admin','super_admin')
        )
      );

    DROP POLICY IF EXISTS "Admins can delete expert images" ON storage.objects;
    CREATE POLICY "Admins can delete expert images"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'expert-images'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.account_type IN ('admin','super_admin')
        )
      );

    DROP POLICY IF EXISTS "Admins can upload resource files" ON storage.objects;
    CREATE POLICY "Admins can upload resource files"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id IN ('resource-files','resource-thumbnails')
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.account_type IN ('admin','super_admin')
        )
      );

    DROP POLICY IF EXISTS "Admins can update resource files" ON storage.objects;
    CREATE POLICY "Admins can update resource files"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id IN ('resource-files','resource-thumbnails')
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.account_type IN ('admin','super_admin')
        )
      );

    DROP POLICY IF EXISTS "Admins can delete resource files" ON storage.objects;
    CREATE POLICY "Admins can delete resource files"
      ON storage.objects FOR DELETE
      USING (
        bucket_id IN ('resource-files','resource-thumbnails')
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.account_type IN ('admin','super_admin')
        )
      );
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping: cannot create admin write policies on storage.objects (insufficient privilege).';
  END;
END $$;

