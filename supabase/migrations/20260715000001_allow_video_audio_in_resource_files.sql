-- Fix: superadmin "Add New Content" video/audio uploads were rejected by
-- Supabase Storage because the resource-files bucket's allowed_mime_types
-- list (set in 20260508000002) only included documents and images — no
-- video/* or audio/* types were ever added. The 50MB file_size_limit also
-- blocked most real video files. This is an additive bucket config update,
-- not a schema change — no DROP/breaking ALTER involved.

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'image/jpeg','image/png','image/webp',
    'video/mp4','video/webm','video/quicktime','video/x-msvideo','video/x-ms-wmv',
    'audio/mpeg','audio/wav','audio/ogg','audio/aac','audio/mp4'
  ],
  file_size_limit = 524288000 -- 500MB (was 50MB)
WHERE id = 'resource-files';
