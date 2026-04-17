-- 20260416000001_update_find_similar_experts_rpc.sql
-- SOW 3.2: Add tenant_id to find_similar_experts RPC return set
-- This enables tenant-aware expert sorting in the AI chat pipeline.

-- Drop the existing function first since we are changing the return type (adding tenant_id)
DROP FUNCTION IF EXISTS public.find_similar_experts(vector, float, int);

CREATE OR REPLACE FUNCTION public.find_similar_experts(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.25,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  expert_id uuid,
  first_name text,
  expert_bio text,
  expert_specialties text[],
  expert_credentials text[],
  expert_experience_years int,
  expert_office_location text,
  expert_rating float,
  expert_total_reviews int,
  expert_consultation_rate float,
  profile_image_url text,
  tenant_id uuid,
  similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS expert_id,
    p.first_name,
    p.expert_bio,
    p.expert_specialties,
    p.expert_credentials,
    p.expert_experience_years,
    p.expert_office_location,
    p.expert_rating::float,
    p.expert_total_reviews,
    p.expert_consultation_rate::float,
    p.profile_image_url,
    p.tenant_id,
    1 - (p.expert_embedding <=> query_embedding) AS similarity
  FROM public.profiles p
  WHERE p.account_type = 'expert'
    AND p.expert_verified = true
    AND p.expert_profile_visibility = true
    AND p.expert_accepts_new_clients = true
    AND 1 - (p.expert_embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
