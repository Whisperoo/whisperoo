-- 20260421000001_seed_pediatrician_reminder.sql
-- Seed the new reminder for pediatrician check-ups (Post-3-Weeks)

INSERT INTO public.care_checklist_templates
  (stage, stage_label, title, description, category, sort_order, is_universal)
VALUES
  ('reminder_pediatrician_schedule', 'Pediatrician Check-ups', 'Follow your pediatrician''s schedule for check-ups',
   'Follow your pediatrician''s recommended schedule for well-baby visits, immunizations, and developmental screenings.',
   'medical', 1, true);
