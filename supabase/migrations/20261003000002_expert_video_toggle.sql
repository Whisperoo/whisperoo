-- =============================================================================
-- Expert intro video on/off switch (client request 2026-10-03).
--
-- `expert_video_url` already exists (20260909000001). The client wants to turn the
-- "Meet {name}" video off per expert — e.g. while a video is being re-recorded —
-- without deleting the upload. The page shows the video only when this is true AND
-- a URL is set. Default true: uploading a video is the opt-in.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS expert_video_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.expert_video_enabled IS
  'Show the intro video on the expert profile. Only meaningful when expert_video_url is set.';

-- ROLLBACK:
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS expert_video_enabled;
