-- 20260408000001_add_flagged_messages_view.sql
CREATE VIEW public.flagged_messages_view AS
SELECT
  m.id,
  m.session_id,
  m.role,
  m.content,
  m.metadata,
  m.is_flagged_for_review,
  m.created_at,
  s.user_id,
  p.first_name AS user_name,
  p.email AS user_email,
  p.tenant_id
FROM public.messages m
JOIN public.sessions s ON m.session_id = s.id
JOIN public.profiles p ON s.user_id = p.id
WHERE m.is_flagged_for_review = true
ORDER BY m.created_at DESC;

CREATE INDEX IF NOT EXISTS idx_messages_flagged_date
  ON public.messages (created_at DESC)
  WHERE is_flagged_for_review = true;
