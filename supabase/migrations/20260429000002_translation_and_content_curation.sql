-- =====================================================
-- 20260429000002_translation_and_content_curation.sql
--
-- Adds translated bio columns to the profiles table.
-- These are populated via Google Cloud Translation API (NMT)
-- when an expert saves their profile (translate-on-write).
--
-- The disabled_product_ids list lives inside tenants.config
-- JSONB — no schema migration needed for that field.
-- =====================================================

-- 1. Add Spanish + Vietnamese bio translation columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS expert_bio_es text,
  ADD COLUMN IF NOT EXISTS expert_bio_vi text;

COMMENT ON COLUMN public.profiles.expert_bio_es IS
  'Spanish translation of expert_bio. Auto-populated via Google Cloud Translation NMT API when expert saves profile.';

COMMENT ON COLUMN public.profiles.expert_bio_vi IS
  'Vietnamese translation of expert_bio. Auto-populated via Google Cloud Translation NMT API when expert saves profile.';
