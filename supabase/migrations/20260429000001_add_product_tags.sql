-- =============================================================
-- 20260429000001_add_product_tags.sql
-- Add tags text[] to products table for label-based filtering.
-- Tags mirror the 11 onboarding topics so personalized ranking
-- can match user interests to product content.
--
-- Usage examples:
--   tags = '{sleep-coaching, postpartum-tips}'
--   tags = '{baby-feeding, nutrition, prenatal-tips}'
-- =============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_products_tags
  ON public.products USING gin(tags);

COMMENT ON COLUMN public.products.tags IS
  'Searchable topic tags matching onboarding topics_of_interest slugs.
   Valid values: baby-feeding, pelvic-floor, sleep-coaching,
   nervous-system, nutrition, pediatric-dentistry, lifestyle-coaching,
   fitness-yoga, back-to-work, postpartum-tips, prenatal-tips';
