-- 20260409000001_add_compliance_training.sql
CREATE TABLE public.compliance_training (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_query   text NOT NULL,
  ai_response  text NOT NULL,
  classification text NOT NULL,
  status       text DEFAULT 'draft',
  tester_id    uuid REFERENCES auth.users(id),
  embedding    vector(1536),
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.compliance_training ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.compliance_training FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.compliance_training FOR INSERT WITH CHECK (auth.uid() = tester_id);
CREATE POLICY "Enable update for authenticated users" ON public.compliance_training FOR UPDATE USING (true);

-- Adding a database function to update embeddings would be too complex here without a Trigger matching pg_vector / OpenAI calls.
-- Typically, embedding generation happens API side.

CREATE OR REPLACE FUNCTION match_compliance_training(
  query_embedding vector(1536),
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
    AND 1 - (ct.embedding <=> query_embedding) > match_threshold
  ORDER BY ct.embedding <=> query_embedding
  LIMIT match_count;
$$;
