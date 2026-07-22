-- Per-expert-card "wrong match?" feedback. Ties a bad recommendation to a
-- specific (message, expert, detected_category) triple so admins can see
-- which category → expert routings misfire, feeding back into the topic
-- taxonomy (Phase 2 admin categories).
--
-- Additive only. Distinct from `compliance_training` (message-level
-- thumbs-down) — that captures overall response quality; this captures
-- which specific expert card was the wrong pick.

CREATE TABLE IF NOT EXISTS public.expert_recommendation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expert_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  detected_category text,
  user_query text,
  reason text NOT NULL CHECK (reason IN ('wrong_specialty', 'not_relevant', 'other')),
  comment text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_expert_recommendation_feedback_expert_id
  ON public.expert_recommendation_feedback(expert_id);
CREATE INDEX IF NOT EXISTS idx_expert_recommendation_feedback_category
  ON public.expert_recommendation_feedback(detected_category);
CREATE INDEX IF NOT EXISTS idx_expert_recommendation_feedback_created_at
  ON public.expert_recommendation_feedback(created_at DESC);

ALTER TABLE public.expert_recommendation_feedback ENABLE ROW LEVEL SECURITY;

-- User can insert their own feedback rows only.
DROP POLICY IF EXISTS "Users can flag own expert recommendations" ON public.expert_recommendation_feedback;
CREATE POLICY "Users can flag own expert recommendations"
  ON public.expert_recommendation_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins/super_admins can read + manage all rows for the review queue.
DROP POLICY IF EXISTS "Admins can read all expert recommendation feedback" ON public.expert_recommendation_feedback;
CREATE POLICY "Admins can read all expert recommendation feedback"
  ON public.expert_recommendation_feedback
  FOR SELECT USING (fn_caller_is_staff_admin());

DROP POLICY IF EXISTS "Admins can update expert recommendation feedback" ON public.expert_recommendation_feedback;
CREATE POLICY "Admins can update expert recommendation feedback"
  ON public.expert_recommendation_feedback
  FOR UPDATE USING (fn_caller_is_staff_admin()) WITH CHECK (fn_caller_is_staff_admin());

DROP POLICY IF EXISTS "Admins can delete expert recommendation feedback" ON public.expert_recommendation_feedback;
CREATE POLICY "Admins can delete expert recommendation feedback"
  ON public.expert_recommendation_feedback
  FOR DELETE USING (fn_caller_is_staff_admin());
