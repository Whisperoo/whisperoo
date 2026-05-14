-- Corrected backfill for Francie's expert specialties.
--
-- Previous migrations 20260513000003 and 20260514000003 used
-- ILIKE 'franice%' (typo) — the actual first_name is 'Francie'.
-- Those migrations matched zero rows so Francie never received
-- the Lactation specialty needed for the recommendation engine.
--
-- This migration:
--   1. Adds Lactation, Baby Feeding, and Breastfeeding specialties
--      to every expert whose first_name starts with 'Francie'.
--   2. Merges those specialties into the tags of all active products
--      linked to those experts (so scoring works from product.tags too).

-- 1. Fix Francie's specialties.
UPDATE public.profiles
SET expert_specialties = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      COALESCE(expert_specialties, ARRAY[]::text[]) ||
      ARRAY['Lactation', 'Baby Feeding', 'Breastfeeding']
    )
  )
)
WHERE account_type = 'expert'
  AND first_name ILIKE 'francie%'
  AND (
    expert_specialties IS NULL
    OR array_length(expert_specialties, 1) IS NULL
    OR NOT (expert_specialties @> ARRAY['Lactation'])
    OR NOT (expert_specialties @> ARRAY['Baby Feeding'])
  );

-- 2. Merge updated specialties into product tags for Francie's products.
UPDATE public.products pr
SET tags = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      COALESCE(pr.tags, ARRAY[]::text[]) ||
      prof.expert_specialties
    )
  )
)
FROM public.profiles prof
WHERE pr.expert_id = prof.id
  AND prof.account_type = 'expert'
  AND prof.first_name ILIKE 'francie%'
  AND prof.expert_specialties IS NOT NULL
  AND array_length(prof.expert_specialties, 1) > 0
  AND pr.is_active = true
  AND NOT (COALESCE(pr.tags, ARRAY[]::text[]) @> prof.expert_specialties);
