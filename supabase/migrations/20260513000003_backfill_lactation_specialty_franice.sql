-- Backfill expert specialties for the lactation expert (Franice) so that
-- users who select "Baby Feeding" or "Lactation" during onboarding get
-- matched correctly by usePersonalizedExpertSort / RecommendedExperts.
--
-- Hotfix scope: only updates rows whose expert_specialties is NULL/empty
-- OR is missing both 'Lactation' and 'Baby Feeding'. Skips otherwise so
-- this migration is idempotent and safe to re-run.

UPDATE profiles
SET expert_specialties = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      COALESCE(expert_specialties, ARRAY[]::text[]) || ARRAY['Lactation', 'Baby Feeding']
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
