-- ============================================================
-- Auto-Translation Database Triggers (Fixed for Supabase Hosted)
-- 
-- Uses pg_net to call the auto-translate Edge Function
-- whenever translatable content is inserted or updated.
-- ============================================================

-- Enable pg_net extension (async HTTP from Postgres)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================
-- Helper: Generic trigger function that calls the Edge Function
-- Hardcodes the Supabase URL and service key since ALTER DATABASE
-- SET is not permitted on Supabase hosted.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_auto_translate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _payload jsonb;
  _fields jsonb;
BEGIN
  -- Build the fields array based on the table
  CASE TG_TABLE_NAME
    WHEN 'products' THEN
      _fields := '[
        {"source": "title", "targets": {"es": "title_es", "vi": "title_vi"}},
        {"source": "description", "targets": {"es": "description_es", "vi": "description_vi"}}
      ]'::jsonb;
    WHEN 'care_checklist_templates' THEN
      _fields := '[
        {"source": "title", "targets": {"es": "title_es", "vi": "title_vi"}},
        {"source": "description", "targets": {"es": "description_es", "vi": "description_vi"}}
      ]'::jsonb;
    WHEN 'profiles' THEN
      _fields := '[
        {"source": "expert_bio", "targets": {"es": "expert_bio_es", "vi": "expert_bio_vi"}}
      ]'::jsonb;
    ELSE
      RETURN NEW;
  END CASE;

  -- Build payload
  _payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'record_id', NEW.id::text,
    'fields', _fields
  );

  -- Fire-and-forget HTTP POST to the Edge Function
  PERFORM net.http_post(
    url     := 'https://wznevejkaefokgibkknt.supabase.co/functions/v1/auto-translate',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6bmV2ZWprYWVmb2tnaWJra250Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTM4ODk1OSwiZXhwIjoyMDY2OTY0OTU5fQ.BtVfN-U2yUpm97pLtBpRNX3y4HLv8QzBnRPHTr6zfD4'
    ),
    body    := _payload
  );

  RETURN NEW;
END;
$$;

-- ============================================================
-- Trigger on PRODUCTS table
-- Only fires when title/description changes AND translations are missing
-- ============================================================
DROP TRIGGER IF EXISTS trg_auto_translate_products ON public.products;
CREATE TRIGGER trg_auto_translate_products
  AFTER INSERT OR UPDATE OF title, description
  ON public.products
  FOR EACH ROW
  WHEN (
    NEW.title IS NOT NULL
    AND (
      NEW.title_es IS NULL OR NEW.title_vi IS NULL
      OR NEW.description_es IS NULL OR NEW.description_vi IS NULL
    )
  )
  EXECUTE FUNCTION public.fn_auto_translate();

-- ============================================================
-- Trigger on CARE_CHECKLIST_TEMPLATES table
-- ============================================================
DROP TRIGGER IF EXISTS trg_auto_translate_checklists ON public.care_checklist_templates;
CREATE TRIGGER trg_auto_translate_checklists
  AFTER INSERT OR UPDATE OF title, description
  ON public.care_checklist_templates
  FOR EACH ROW
  WHEN (
    NEW.title IS NOT NULL
    AND (
      NEW.title_es IS NULL OR NEW.title_vi IS NULL
      OR NEW.description_es IS NULL OR NEW.description_vi IS NULL
    )
  )
  EXECUTE FUNCTION public.fn_auto_translate();

-- ============================================================
-- Trigger on PROFILES table (expert bios only)
-- Only fires when expert_bio changes and translations are missing
-- ============================================================
DROP TRIGGER IF EXISTS trg_auto_translate_expert_bio ON public.profiles;
CREATE TRIGGER trg_auto_translate_expert_bio
  AFTER INSERT OR UPDATE OF expert_bio
  ON public.profiles
  FOR EACH ROW
  WHEN (
    NEW.expert_bio IS NOT NULL
    AND NEW.expert_bio != ''
    AND (NEW.expert_bio_es IS NULL OR NEW.expert_bio_vi IS NULL)
  )
  EXECUTE FUNCTION public.fn_auto_translate();
