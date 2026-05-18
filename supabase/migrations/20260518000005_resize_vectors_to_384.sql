-- Switch from OpenAI text-embedding-3-small (1536-dim) to Supabase gte-small (384-dim).
-- All embeddings must be cleared and regenerated after this migration.
-- Drop indexes before altering columns (pgvector requires this).

-- ── expert_documents ──────────────────────────────────────────────────────────
DROP INDEX IF EXISTS expert_documents_embedding_idx;
UPDATE public.expert_documents SET embedding = NULL;
ALTER TABLE public.expert_documents
  ALTER COLUMN embedding TYPE vector(384);
CREATE INDEX expert_documents_embedding_idx
  ON public.expert_documents USING ivfflat (embedding vector_cosine_ops);

-- ── compliance_training ───────────────────────────────────────────────────────
UPDATE public.compliance_training SET embedding = NULL;
ALTER TABLE public.compliance_training
  ALTER COLUMN embedding TYPE vector(384);

-- ── profiles.expert_embedding (may not exist on all envs) ────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'expert_embedding'
  ) THEN
    UPDATE public.profiles SET expert_embedding = NULL WHERE expert_embedding IS NOT NULL;
    ALTER TABLE public.profiles ALTER COLUMN expert_embedding TYPE vector(384);
  END IF;
END;
$$;

-- ── expert_embeddings table (may not exist on all envs) ──────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'expert_embeddings'
  ) THEN
    UPDATE public.expert_embeddings SET embedding = NULL WHERE embedding IS NOT NULL;
    ALTER TABLE public.expert_embeddings ALTER COLUMN embedding TYPE vector(384);
  END IF;
END;
$$;

-- ── match_compliance_training RPC ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_compliance_training(
  query_embedding vector(384),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  user_query text,
  ai_response text,
  classification text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ct.id,
    ct.user_query,
    ct.ai_response,
    ct.classification,
    1 - (ct.embedding <=> query_embedding) AS similarity
  FROM compliance_training ct
  WHERE ct.status = 'approved'
    AND ct.embedding IS NOT NULL
    AND 1 - (ct.embedding <=> query_embedding) > match_threshold
  ORDER BY ct.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ── find_similar_experts RPC ──────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.find_similar_experts(vector, float, int);

CREATE OR REPLACE FUNCTION public.find_similar_experts(
  query_embedding vector(384),
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
    AND p.expert_embedding IS NOT NULL
    AND 1 - (p.expert_embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
