-- Direct SQL to check current embeddings and manual embedding generation
-- First, let's see current state
SELECT
  p.first_name,
  p.expert_specialties,
  p.expert_bio,
  CASE WHEN e.expert_id IS NOT NULL THEN 'HAS EMBEDDING' ELSE 'MISSING' END as embedding_status,
  e.created_at as embedding_created
FROM profiles p
LEFT JOIN expert_embeddings e ON p.id = e.expert_id
WHERE p.account_type = 'expert'
ORDER BY p.first_name;