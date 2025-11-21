-- Migration: Add birth_date column to kids table  
-- Date: 2025-07-02
-- Purpose: Store child birthdate to calculate age dynamically instead of static age text
-- Note: This migration runs AFTER 20250702000000_rename_children_to_kids.sql

-- Check if birth_date column already exists (it should exist from rename migration)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kids' AND column_name = 'birth_date') THEN
        ALTER TABLE public.kids ADD COLUMN birth_date DATE;
        COMMENT ON COLUMN public.kids.birth_date IS 'Child birth date for automatic age calculation';
    END IF;
END $$;