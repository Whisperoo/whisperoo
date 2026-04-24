-- =============================================================
-- 20260424000002_add_message_category.sql
-- GIN index on messages.metadata for fast category grouping
-- in admin dashboard concern-themes queries.
-- No schema change needed — metadata is already JSONB.
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_messages_metadata_gin
  ON public.messages USING gin(metadata jsonb_path_ops);

-- Partial index specifically for category lookups (most common admin query)
CREATE INDEX IF NOT EXISTS idx_messages_category
  ON public.messages ((metadata->>'category'))
  WHERE role = 'user';

-- Partial index for flagged messages (powers escalation KPI + audit trail)
CREATE INDEX IF NOT EXISTS idx_messages_flagged_user
  ON public.messages (created_at DESC)
  WHERE is_flagged_for_review = true AND role = 'user';
