-- Migration: Add personal_context column to profiles table
-- Date: 2025-07-02
-- Purpose: Store user's personal context from onboarding step 5 for AI chat personalization

-- Add personal_context column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN personal_context TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.personal_context IS 'Free-form text from onboarding describing what user is looking for help with, challenges, or family context';