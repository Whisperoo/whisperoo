-- =============================================================
-- 20260428000001_hipaa_fix_audit_trail.sql
-- HIPAA Compliance Fix: Remove individual patient identifier
-- (first_name / user_name) from the admin AI audit trail view.
--
-- Before: exposed p.first_name AS user_name  ← individual identifier
-- After:  cohort code only (COHORT-QR_OB, COHORT-GENERAL, etc.)
--
-- SOW 6.1 — No individual patient identifiers in any dashboard view.
-- Submit to hospital compliance team by April 30.
-- =============================================================

-- DROP required because CREATE OR REPLACE VIEW cannot remove existing columns (PG error 42P16)
DROP VIEW IF EXISTS public.admin_ai_audit_trail;

CREATE VIEW public.admin_ai_audit_trail AS
SELECT
  m.id                                                        AS message_id,
  m.created_at,
  s.user_id,
  -- REMOVED: p.first_name AS user_name  ← HIPAA violation (individual identifier)
  p.tenant_id,
  -- Cohort derived from acquisition_source — no name, no MRN, no DOB
  CASE
    WHEN p.acquisition_source IS NOT NULL
      THEN 'COHORT-' || UPPER(p.acquisition_source)
    ELSE 'COHORT-GENERAL'
  END                                                         AS cohort,
  -- Category written by edge function into messages.metadata
  COALESCE(m.metadata->>'category', 'General Parenting')     AS category,
  -- Truncated content — 150 chars max, no patient-identifying context
  LEFT(m.content, 150)                                        AS summary,
  m.is_flagged_for_review                                     AS escalation,
  m.metadata
FROM public.messages m
JOIN public.sessions  s ON s.id = m.session_id
JOIN public.profiles  p ON p.id = s.user_id
WHERE m.role = 'user'
ORDER BY m.created_at DESC;
