-- Migration: Add translation columns to products table

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS title_es text,
  ADD COLUMN IF NOT EXISTS title_vi text,
  ADD COLUMN IF NOT EXISTS description_es text,
  ADD COLUMN IF NOT EXISTS description_vi text;

COMMENT ON COLUMN public.products.title_es IS 'Spanish translation of title. Auto-populated via Google Cloud Translation NMT API.';
COMMENT ON COLUMN public.products.title_vi IS 'Vietnamese translation of title. Auto-populated via Google Cloud Translation NMT API.';
COMMENT ON COLUMN public.products.description_es IS 'Spanish translation of description. Auto-populated via Google Cloud Translation NMT API.';
COMMENT ON COLUMN public.products.description_vi IS 'Vietnamese translation of description. Auto-populated via Google Cloud Translation NMT API.';
