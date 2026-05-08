-- Migration: Fix expert image upload RLS for superadmin tooling
-- ======================================================
-- Problem:
-- - Admin expert creation uploads to bucket `expert-images`.
-- - Existing storage policy requires caller profile.account_type in ('admin','super_admin').
-- - Some valid superadmins are email-allowlisted but may not have account_type set, causing
--   uploads to fail with "new row violates row-level security policy".
--
-- Fix:
-- - Keep account_type-based access.
-- - Also allow approved superadmin emails (same allowlist pattern used elsewhere).

DROP POLICY IF EXISTS "Admins can upload expert images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update expert images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete expert images" ON storage.objects;

CREATE POLICY "Admins can upload expert images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'expert-images'
    AND (
      (auth.jwt() ->> 'email') IN ('engineering@whisperoo.app', 'sharab.khan101010@gmail.com')
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.account_type IN ('admin', 'super_admin')
      )
    )
  );

CREATE POLICY "Admins can update expert images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'expert-images'
    AND (
      (auth.jwt() ->> 'email') IN ('engineering@whisperoo.app', 'sharab.khan101010@gmail.com')
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.account_type IN ('admin', 'super_admin')
      )
    )
  );

CREATE POLICY "Admins can delete expert images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'expert-images'
    AND (
      (auth.jwt() ->> 'email') IN ('engineering@whisperoo.app', 'sharab.khan101010@gmail.com')
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.account_type IN ('admin', 'super_admin')
      )
    )
  );

