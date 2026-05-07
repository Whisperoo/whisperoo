-- Migration: Normalize product tags
-- ============================================================
-- WHY THIS APPROACH:
-- The recommendation engine and tag filtering pills rely on
-- consistent tag formats. Currently, products have tags like
-- 'baby-feeding' or 'breastfeeding', while the UI sends
-- 'baby-feeding'. To ensure exact string overlaps in Postgres
-- and proper client-side scoring, we normalize all existing tags
-- to the canonical English labels defined by the onboarding topics.
-- ============================================================

UPDATE public.products
SET tags = ARRAY(
  SELECT DISTINCT
    CASE
      -- Normalize slug variants and legacy tags to the canonical label
      WHEN lower(t) IN ('baby-feeding','babyfeeding','breastfeeding','breast-feeding','lactation') THEN 'Baby Feeding'
      WHEN lower(t) IN ('pelvic-floor','pelvicfloor','womens-health') THEN 'Pelvic Floor'
      WHEN lower(t) IN ('sleep-coaching','sleep coaching','sleep','routines') THEN 'Sleep Coaching'
      WHEN lower(t) IN ('nervous-system','nervous system regulation','nervous system','mental-health','anxiety') THEN 'Nervous System Regulation'
      WHEN lower(t) = 'nutrition' THEN 'Nutrition'
      WHEN lower(t) IN ('pediatric-dentistry','pediatric dentistry','dental') THEN 'Pediatric Dentistry'
      WHEN lower(t) IN ('lifestyle-coaching','lifestyle coaching','lifestyle') THEN 'Lifestyle Coaching'
      WHEN lower(t) IN ('fitness-yoga','fitness/yoga','fitness & yoga','fitness','yoga') THEN 'Fitness/yoga'
      WHEN lower(t) IN ('back-to-work','back to work','career') THEN 'Back to Work'
      WHEN lower(t) IN ('postpartum-tips','postpartum tips','postpartum','postnatal','recovery') THEN 'Postpartum Tips'
      WHEN lower(t) IN ('prenatal-tips','prenatal tips','prenatal','pregnancy','expecting') THEN 'Prenatal Tips'
      ELSE t -- Preserve any other custom tags unchanged
    END
  FROM unnest(tags) AS t
)
WHERE tags IS NOT NULL AND array_length(tags, 1) > 0;
