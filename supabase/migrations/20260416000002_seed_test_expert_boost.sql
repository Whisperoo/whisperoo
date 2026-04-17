-- 20260416000002_seed_test_expert_boost.sql
-- Seed 1 sample expert_boost_id into active tenant configs for testing (SOW 3.1)
-- This picks the first verified expert and adds their ID to expert_boost_ids.

UPDATE public.tenants
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{expert_boost_ids}',
  (
    SELECT COALESCE(jsonb_agg(id), '[]'::jsonb)
    FROM (
      SELECT id FROM public.profiles
      WHERE account_type = 'expert' AND expert_verified = true
      LIMIT 1
    ) sub
  )
)
WHERE is_active = true;
