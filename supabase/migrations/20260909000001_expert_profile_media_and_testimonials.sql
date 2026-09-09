-- Expert profile rework: testimonials + richer profile media.
--
-- Scoped from the Phase 2 plan (Part 6). The UI is deliberately NOT built here --
-- the Figma file ("Whisperoo — changes for Dev") is not final, and per the client's
-- own SOW the build waits on it. The data model can land ahead of the visuals, so
-- the admin CRUD has something to write to the moment the designs arrive.
--
-- Naming: everything carries the `expert_` prefix, matching every existing expert
-- field on profiles (expert_bio, expert_credentials, expert_website_url, ...). The
-- plan sketched a bare `testimonials` table; `expert_testimonials` is used instead
-- because an unqualified name reads as though it could hold testimonials about
-- anything, and renaming a table after it has data and policies is far more work
-- than choosing well now.
--
-- Localisation: quote_es / quote_vi and the extended-bio translations are included
-- even though the plan did not mention them. SOW 5.4 requires expert profile content
-- to render in the user's language, and expert_bio already carries _es/_vi. Adding
-- them later would mean a second migration plus a backfill of live content.
--
-- Auto-translation is deliberately NOT wired up yet. The trigger pattern exists
-- (fn_auto_translate on products, profiles, care_checklist_templates) but attaching
-- it before any testimonial exists, and before the UI defines how quotes are entered,
-- would be speculative. The columns are ready when we want it.

-- ---------------------------------------------------------------------------
-- 1. Expert media on profiles
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS expert_video_url        text,
  ADD COLUMN IF NOT EXISTS expert_gallery_urls     text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS expert_extended_bio     text,
  ADD COLUMN IF NOT EXISTS expert_extended_bio_es  text,
  ADD COLUMN IF NOT EXISTS expert_extended_bio_vi  text;

COMMENT ON COLUMN public.profiles.expert_video_url IS
  'Optional intro video for the expert profile. Stored in Cloudflare R2 like other expert media.';
COMMENT ON COLUMN public.profiles.expert_gallery_urls IS
  'Ordered gallery image URLs for the expert profile. Array order is display order.';
COMMENT ON COLUMN public.profiles.expert_extended_bio IS
  'Long-form biography for the expert detail page. expert_bio remains the short version used on cards.';

-- ---------------------------------------------------------------------------
-- 2. Testimonials
--
-- Admin-entered, never expert self-service: an expert must not be able to write
-- or edit praise attributed to a patient. Enforced by the RLS policies below --
-- there is no expert-facing write path at all.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expert_testimonials (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name       text NOT NULL,
  author_context    text,
  quote             text NOT NULL,
  quote_es          text,
  quote_vi          text,
  testimonial_date  date,
  display_order     integer NOT NULL DEFAULT 0,
  published         boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.expert_testimonials IS
  'Admin-curated testimonials shown on expert profiles. Not expert self-service.';
COMMENT ON COLUMN public.expert_testimonials.author_context IS
  'Short attribution shown under the name, e.g. "Mother of two, OB patient". Keep non-identifying.';
COMMENT ON COLUMN public.expert_testimonials.published IS
  'Defaults FALSE so nothing goes live by accident. These are real people''s words about healthcare -- publishing is an explicit act.';

CREATE INDEX IF NOT EXISTS idx_expert_testimonials_expert
  ON public.expert_testimonials (expert_id, display_order);

-- Only published rows are ever read by the app; keep that path cheap.
CREATE INDEX IF NOT EXISTS idx_expert_testimonials_published
  ON public.expert_testimonials (expert_id, display_order)
  WHERE published;

DROP TRIGGER IF EXISTS update_expert_testimonials_updated_at ON public.expert_testimonials;
CREATE TRIGGER update_expert_testimonials_updated_at
  BEFORE UPDATE ON public.expert_testimonials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 3. RLS
--
-- Mirrors the pattern used by expert_recommendation_feedback: staff admins manage,
-- everyone else is tightly scoped. Readers see a testimonial only when it is
-- published AND the expert it belongs to is themselves visible -- otherwise
-- unpublishing an expert would leave their testimonials reachable.
-- ---------------------------------------------------------------------------
ALTER TABLE public.expert_testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage expert testimonials" ON public.expert_testimonials;
CREATE POLICY "Admins manage expert testimonials"
  ON public.expert_testimonials
  FOR ALL
  USING (fn_caller_is_staff_admin())
  WITH CHECK (fn_caller_is_staff_admin());

DROP POLICY IF EXISTS "Anyone can read published testimonials for visible experts" ON public.expert_testimonials;
CREATE POLICY "Anyone can read published testimonials for visible experts"
  ON public.expert_testimonials
  FOR SELECT
  TO authenticated
  USING (
    published
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = expert_testimonials.expert_id
        AND p.account_type = 'expert'
        AND COALESCE(p.expert_profile_visibility, false)
    )
  );

GRANT SELECT ON public.expert_testimonials TO authenticated;
GRANT ALL    ON public.expert_testimonials TO service_role;

-- ---------------------------------------------------------------------------
-- ROLLBACK (manual)
--   DROP TABLE IF EXISTS public.expert_testimonials;
--   ALTER TABLE public.profiles
--     DROP COLUMN IF EXISTS expert_extended_bio_vi,
--     DROP COLUMN IF EXISTS expert_extended_bio_es,
--     DROP COLUMN IF EXISTS expert_extended_bio,
--     DROP COLUMN IF EXISTS expert_gallery_urls,
--     DROP COLUMN IF EXISTS expert_video_url;
-- ---------------------------------------------------------------------------
