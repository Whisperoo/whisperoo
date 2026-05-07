-- Migration: Add is_free column to products table
-- This supports the content addition and editing forms in the Super Admin panel.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_free boolean DEFAULT false;

-- Update existing records: if price is 0, it's free.
UPDATE public.products SET is_free = true WHERE price = 0;
