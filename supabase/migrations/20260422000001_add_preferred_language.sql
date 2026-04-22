-- Add preferred_language to profiles table to persist user localization choice
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';

COMMENT ON COLUMN profiles.preferred_language IS 'User preferred language code for UI localization (e.g., en, es, vi)';
