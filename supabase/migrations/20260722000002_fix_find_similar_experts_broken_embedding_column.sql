-- CRITICAL FIX: find_similar_experts has been silently broken since it was
-- introduced. It queries `p.expert_embedding` directly on `profiles`, but that
-- column has never existed on this database — real expert embeddings live in
-- the separate `expert_embeddings` table (expert_id, profile_text, embedding),
-- written correctly by generate_expert_embeddings/index.ts. PL/pgSQL does not
-- validate column references at CREATE FUNCTION time, only at execution, so
-- every migration that recreated this RPC applied cleanly — but every actual
-- call errored at runtime with "column p.expert_embedding does not exist".
-- findMatchingExpertsBySemantic (chat_ai_rag_fixed/index.ts) catches that
-- error and silently returns [], so semantic expert matching has never
-- actually run — the AI chat has been relying entirely on the keyword-fallback
-- path this whole time, which only catches specialties someone thought to
-- hand-enumerate as a keyword group (e.g. the Shivani/dental bug: her bio
-- text would have matched semantically regardless of any keyword list).
--
-- Fix: join expert_embeddings on expert_id instead of referencing the
-- nonexistent profiles column. All existing eligibility filters (verified,
-- visibility, accepts-new-clients, availability) are preserved unchanged —
-- only the embedding source is corrected.

DROP FUNCTION IF EXISTS public.find_similar_experts(vector(384), float, int);

CREATE OR REPLACE FUNCTION public.find_similar_experts(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.10,
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
    1 - (ee.embedding <=> query_embedding) AS similarity
  FROM public.profiles p
  JOIN public.expert_embeddings ee ON ee.expert_id = p.id
  WHERE p.account_type = 'expert'
    AND p.expert_verified = true
    AND p.expert_profile_visibility = true
    AND p.expert_accepts_new_clients = true
    AND COALESCE(p.expert_availability_status, 'available') != 'unavailable'
    AND ee.embedding IS NOT NULL
    AND 1 - (ee.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_similar_experts(vector(384), float, int) TO authenticated;
