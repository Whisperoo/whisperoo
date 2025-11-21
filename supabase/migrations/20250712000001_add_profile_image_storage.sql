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
);

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all profile images (public bucket)
CREATE POLICY "Profile images are publicly viewable" ON storage.objects
FOR SELECT USING (bucket_id = 'profile-images');

-- Policy: Users can upload their own profile images  
CREATE POLICY "Users can upload their own profile images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'profile-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own profile images
CREATE POLICY "Users can update their own profile images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'profile-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own profile images
CREATE POLICY "Users can delete their own profile images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'profile-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);