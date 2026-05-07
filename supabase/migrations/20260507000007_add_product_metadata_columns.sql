-- Add status and difficulty_level columns to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'published',
ADD COLUMN IF NOT EXISTS difficulty_level text DEFAULT 'intermediate';

-- Update existing products to have default values
UPDATE public.products SET status = 'published' WHERE status IS NULL;
UPDATE public.products SET difficulty_level = 'intermediate' WHERE difficulty_level IS NULL;
