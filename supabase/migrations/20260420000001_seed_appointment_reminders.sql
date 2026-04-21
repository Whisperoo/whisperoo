-- 20260420000001_seed_appointment_reminders.sql
-- Week 3 Day 1: Appointment Reminder checklist items
-- These use special stage keys matched by the AppointmentReminders widget
-- based on precise gestational-week / days-since-birth logic.

-- ═══════════════════════════════════════
-- REMINDER 1 — First Trimester Prenatal (Weeks 1-13)
-- ═══════════════════════════════════════
INSERT INTO public.care_checklist_templates
  (stage, stage_label, title, description, category, sort_order, is_universal)
VALUES
  ('reminder_prenatal_t1', 'First Trimester Prenatal', 'Schedule your first prenatal visit',
   'Your first prenatal appointment confirms pregnancy, estimates due date, and sets up ongoing monitoring with your OB/GYN or midwife. Most providers recommend booking this between weeks 8-10.',
   'medical', 1, true);

-- ═══════════════════════════════════════
-- REMINDER 2 — Birth Plan Check-in (Weeks 20-32)
-- ═══════════════════════════════════════
INSERT INTO public.care_checklist_templates
  (stage, stage_label, title, description, category, sort_order, is_universal)
VALUES
  ('reminder_birth_plan', 'Birth Plan Check-in', 'Review your birth plan with your provider',
   'Between weeks 24-32 is the ideal window to discuss your birth preferences — pain management, delivery location, who will be present, and any special requests — with your care team.',
   'milestone', 1, true);

-- ═══════════════════════════════════════
-- REMINDER 3 — 48hr Post-Discharge (within 2 days of birth)
-- ═══════════════════════════════════════
INSERT INTO public.care_checklist_templates
  (stage, stage_label, title, description, category, sort_order, is_universal)
VALUES
  ('reminder_48hr_postdischarge', '48-Hour Post-Discharge', 'Schedule your 48-hour post-discharge check',
   'Within 48 hours of leaving the hospital, schedule a follow-up for mom and baby. This visit checks jaundice levels, weight, feeding, and mom''s recovery.',
   'medical', 1, true);

-- ═══════════════════════════════════════
-- REMINDER 4 — 3-Week Postpartum Check-in (up to 21 days after birth)
-- ═══════════════════════════════════════
INSERT INTO public.care_checklist_templates
  (stage, stage_label, title, description, category, sort_order, is_universal)
VALUES
  ('reminder_3wk_postpartum', '3-Week Postpartum Check-in', 'Book your postpartum wellness visit',
   'In the first 3 weeks after delivery, a postpartum visit assesses physical recovery, emotional well-being, breastfeeding support, and screens for postpartum depression.',
   'medical', 1, true);
