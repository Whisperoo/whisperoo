-- Migration: Add missing profile columns for complete AI context
-- Date: 2025-07-02
-- Purpose: Add parenting_styles and topics_of_interest columns that are referenced in AuthContext but missing from database

-- Add parenting_styles column (array of text)
ALTER TABLE public.profiles 
ADD COLUMN parenting_styles text[] DEFAULT '{}';

-- Add topics_of_interest column (array of text)  
ALTER TABLE public.profiles
ADD COLUMN topics_of_interest text[] DEFAULT '{}';

-- Add role column if it doesn't exist (user role from onboarding)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
        ALTER TABLE public.profiles ADD COLUMN role text;
    END IF;
END $$;

-- Add expecting_status column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'expecting_status') THEN
        ALTER TABLE public.profiles ADD COLUMN expecting_status text;
    END IF;
END $$;

-- Add has_kids column if it doesn't exist  
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'has_kids') THEN
        ALTER TABLE public.profiles ADD COLUMN has_kids boolean DEFAULT false;
    END IF;
END $$;

-- Add kids_count column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'kids_count') THEN
        ALTER TABLE public.profiles ADD COLUMN kids_count integer DEFAULT 0;
    END IF;
END $$;

-- Add custom_role column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'custom_role') THEN
        ALTER TABLE public.profiles ADD COLUMN custom_role text;
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.parenting_styles IS 'Array of selected parenting styles from onboarding';
COMMENT ON COLUMN public.profiles.topics_of_interest IS 'Array of selected topics of interest from onboarding';
COMMENT ON COLUMN public.profiles.role IS 'User role: mom, dad, caregiver, or other';
COMMENT ON COLUMN public.profiles.expecting_status IS 'Expecting status: yes, no, or trying';
COMMENT ON COLUMN public.profiles.has_kids IS 'Whether user has existing children';
COMMENT ON COLUMN public.profiles.kids_count IS 'Number of children user has';
COMMENT ON COLUMN public.profiles.custom_role IS 'Custom role text when role is "other"';