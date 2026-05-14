-- ==========================================================================
-- Backfill product tags from expert specialties (recommendation fix).
--
-- Root cause: products had no canonical topic tags so the personalised sort
-- couldn't score them for users who selected Lactation / Baby Feeding etc.
-- The recommendation engine matches both product.tags AND
-- product.expert.expert_specialties, but expert_specialties were NULL for
-- some experts (notably Franice).
--
-- This migration:
--   1. Re-applies the Franice lactation specialty backfill (idempotent).
--   2. For every active product whose expert has non-empty specialties,
--      merges those specialties into product.tags so scoring works from
--      both signals.
-- ==========================================================================

-- 1. Ensure Franice has the correct specialties (idempotent).
UPDATE public.profiles
SET expert_specialties = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      COALESCE(expert_specialties, ARRAY[]::text[]) ||
      ARRAY['Lactation', 'Baby Feeding']
    )
  )
)
WHERE account_type = 'expert'
  AND first_name ILIKE 'franice%'
  AND (
    expert_specialties IS NULL
    OR array_length(expert_specialties, 1) IS NULL
    OR NOT (expert_specialties @> ARRAY['Lactation'])
    OR NOT (expert_specialties @> ARRAY['Baby Feeding'])
  );

-- 2. Merge expert specialties into product tags for all active products.
--    Only touches rows where at least one specialty is missing from tags.
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
  AND prof.expert_specialties IS NOT NULL
  AND array_length(prof.expert_specialties, 1) > 0
  AND pr.is_active = true
  AND NOT (COALESCE(pr.tags, ARRAY[]::text[]) @> prof.expert_specialties);
