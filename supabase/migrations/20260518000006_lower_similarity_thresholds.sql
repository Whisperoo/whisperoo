-- Lower default match_threshold on find_similar_experts from 0.25 → 0.08.
-- text-embedding-3-small at 384-dim produces lower cosine scores than
-- full 1536-dim; 0.25 was silently filtering out legitimate matches.

CREATE OR REPLACE FUNCTION public.find_similar_experts(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.08,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  expert_id uuid, first_name text, expert_bio text,
  expert_specialties text[], expert_credentials text[],
  expert_experience_years int, expert_office_location text,
  expert_rating float, expert_total_reviews int,
  expert_consultation_rate float, profile_image_url text,
  tenant_id uuid, similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.first_name, p.expert_bio, p.expert_specialties,
    p.expert_credentials, p.expert_experience_years, p.expert_office_location,
    p.expert_rating::float, p.expert_total_reviews,
    p.expert_consultation_rate::float, p.profile_image_url, p.tenant_id,
    1 - (p.expert_embedding <=> query_embedding) AS similarity
  FROM public.profiles p
  WHERE p.account_type = 'expert'
    AND p.expert_verified = true
    AND p.expert_profile_visibility = true
    AND p.expert_accepts_new_clients = true
    AND p.expert_embedding IS NOT NULL
    AND 1 - (p.expert_embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Lower match_compliance_training threshold too
CREATE OR REPLACE FUNCTION match_compliance_training(
  query_embedding vector(384),
  match_threshold float,
  match_count int
)
RETURNS TABLE (id uuid, user_query text, ai_response text, classification text, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT ct.id, ct.user_query, ct.ai_response, ct.classification,
    1 - (ct.embedding <=> query_embedding) AS similarity
  FROM compliance_training ct
  WHERE ct.status = 'approved'
    AND ct.embedding IS NOT NULL
    AND 1 - (ct.embedding <=> query_embedding) > match_threshold
  ORDER BY ct.embedding <=> query_embedding
  LIMIT match_count;
$$;
