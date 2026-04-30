-- Migration: Add translation columns to care_checklist_templates table

ALTER TABLE public.care_checklist_templates
  ADD COLUMN IF NOT EXISTS title_es text,
  ADD COLUMN IF NOT EXISTS title_vi text,
  ADD COLUMN IF NOT EXISTS description_es text,
  ADD COLUMN IF NOT EXISTS description_vi text;

COMMENT ON COLUMN public.care_checklist_templates.title_es IS 'Spanish translation of title. Auto-populated via Google Cloud Translation NMT API.';
COMMENT ON COLUMN public.care_checklist_templates.title_vi IS 'Vietnamese translation of title. Auto-populated via Google Cloud Translation NMT API.';
COMMENT ON COLUMN public.care_checklist_templates.description_es IS 'Spanish translation of description. Auto-populated via Google Cloud Translation NMT API.';
COMMENT ON COLUMN public.care_checklist_templates.description_vi IS 'Vietnamese translation of description. Auto-populated via Google Cloud Translation NMT API.';
