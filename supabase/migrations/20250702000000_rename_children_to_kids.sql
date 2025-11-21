-- Migration: Rename children table to kids and add expecting baby functionality
-- Date: 2025-07-02  
-- Purpose: Fix schema mismatch between database (children) and application code (kids)
-- This migration must run BEFORE 20250702000003_add_birth_date_to_kids.sql

-- Rename children table to kids
ALTER TABLE public.children RENAME TO kids;

-- Add missing columns for expecting baby functionality
ALTER TABLE public.kids 
ADD COLUMN is_expecting boolean DEFAULT false,
ADD COLUMN due_date date,
ADD COLUMN expected_name text;

-- Update RLS policy name and reference to new table name
DROP POLICY IF EXISTS "parent_reads_writes_kids" ON public.children;
CREATE POLICY "parent_reads_writes_kids" ON public.kids
  USING  ( parent_id = auth.uid() )
  WITH CHECK ( parent_id = auth.uid() );

-- Update trigger function name to match new table
DROP TRIGGER IF EXISTS trg_set_child_updated ON public.children;
CREATE TRIGGER trg_set_kids_updated
 BEFORE UPDATE ON public.kids
 FOR EACH ROW EXECUTE PROCEDURE public.set_child_updated_at();

-- Update index (indexes are automatically moved with table rename)
-- The existing index on (parent_id) is automatically renamed

-- Add comments for new columns
COMMENT ON COLUMN public.kids.is_expecting IS 'Whether this record represents an expecting baby (due date) vs born child (birth date)';
COMMENT ON COLUMN public.kids.due_date IS 'Expected due date for expecting babies';
COMMENT ON COLUMN public.kids.expected_name IS 'Name for expecting baby before birth';

-- Add constraint to ensure data integrity
ALTER TABLE public.kids 
ADD CONSTRAINT check_expecting_or_born 
CHECK (
  (is_expecting = true AND due_date IS NOT NULL) OR 
  (is_expecting = false AND birth_date IS NOT NULL) OR
  (is_expecting IS NULL OR is_expecting = false)
);