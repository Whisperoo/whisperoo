-- ============================================================
-- Care Checklist Template Seed Data
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Newborn (0-3 months) — Universal templates
INSERT INTO care_checklist_templates (stage, stage_label, title, description, category, sort_order, is_universal, tenant_id, hospital_phone)
VALUES
  ('newborn_0_3m', 'Newborn (0-3 months)', 'Schedule 2-week pediatrician visit', 'First weight check and overall health assessment after birth.', 'medical', 1, true, null, null),
  ('newborn_0_3m', 'Newborn (0-3 months)', 'Schedule 1-month pediatrician visit', 'Vaccinations begin and developmental check.', 'medical', 2, true, null, null),
  ('newborn_0_3m', 'Newborn (0-3 months)', 'Schedule 2-month pediatrician visit', 'Second round of vaccinations and growth check.', 'medical', 3, true, null, null),
  ('newborn_0_3m', 'Newborn (0-3 months)', 'Complete newborn hearing screening', 'Typically done in hospital before discharge.', 'medical', 4, true, null, null),
  ('newborn_0_3m', 'Newborn (0-3 months)', 'Set up safe sleep environment', 'Firm flat surface, no loose bedding, baby sleeps alone on their back.', 'safety', 5, true, null, null),
  ('newborn_0_3m', 'Newborn (0-3 months)', 'Begin tummy time daily', 'Start with 2–3 minutes several times a day to strengthen neck muscles.', 'milestone', 6, true, null, null),
  ('newborn_0_3m', 'Newborn (0-3 months)', 'Establish feeding routine', 'Breastfeed every 2-3 hours or formula feed every 3-4 hours.', 'nutrition', 7, true, null, null),
  ('newborn_0_3m', 'Newborn (0-3 months)', 'Track wet and dirty diapers', 'Minimum 6 wet diapers per day signals adequate feeding.', 'nutrition', 8, true, null, null),
  ('newborn_0_3m', 'Newborn (0-3 months)', 'Schedule postpartum OB checkup (6-week)', 'Your own recovery check — physical and emotional wellbeing.', 'medical', 9, true, null, null),
  ('newborn_0_3m', 'Newborn (0-3 months)', 'Register baby''s birth certificate', 'Required within 10 days of birth in most states.', 'general', 10, true, null, null),

-- Infant (3-6 months) — Universal templates
  ('infant_3_6m', 'Infant (3-6 months)', 'Schedule 4-month pediatrician visit', 'Growth check and vaccinations.', 'medical', 1, true, null, null),
  ('infant_3_6m', 'Infant (3-6 months)', 'Schedule 6-month pediatrician visit', 'Flu shot if in season, continued developmental review.', 'medical', 2, true, null, null),
  ('infant_3_6m', 'Infant (3-6 months)', 'Continue daily tummy time', 'Increase to 20-30 minutes per day as baby gets stronger.', 'milestone', 3, true, null, null),
  ('infant_3_6m', 'Infant (3-6 months)', 'Watch for rolling over milestone', 'Most babies roll front-to-back around 4-5 months.', 'milestone', 4, true, null, null),
  ('infant_3_6m', 'Infant (3-6 months)', 'Introduce solid foods readiness check', 'Baby can sit with support and shows interest in food around 4-6 months.', 'nutrition', 5, true, null, null),
  ('infant_3_6m', 'Infant (3-6 months)', 'Ensure car seat is correctly installed', 'Rear-facing until at least age 2. Check for recalls.', 'safety', 6, true, null, null),

-- Infant (6-12 months) — Universal templates
  ('infant_6_12m', 'Infant (6-12 months)', 'Schedule 9-month pediatrician visit', 'Developmental screening and growth check.', 'medical', 1, true, null, null),
  ('infant_6_12m', 'Infant (6-12 months)', 'Schedule 12-month pediatrician visit', 'MMR and varicella vaccines, lead screening.', 'medical', 2, true, null, null),
  ('infant_6_12m', 'Infant (6-12 months)', 'Begin introducing solids', 'Pureed fruits, vegetables, and iron-rich foods.', 'nutrition', 3, true, null, null),
  ('infant_6_12m', 'Infant (6-12 months)', 'Baby-proof your home', 'Cabinet locks, outlet covers, gates on stairs.', 'safety', 4, true, null, null),
  ('infant_6_12m', 'Infant (6-12 months)', 'Watch for sitting and crawling milestones', 'Most babies sit alone by 6-9 months and crawl by 9-10 months.', 'milestone', 5, true, null, null),
  ('infant_6_12m', 'Infant (6-12 months)', 'Introduce a cup for water', 'Around 6-9 months, introduce a sippy or open cup.', 'nutrition', 6, true, null, null),

-- Expecting T1 — Universal templates
  ('expecting_t1', 'First Trimester', 'Schedule first prenatal appointment', 'Confirm pregnancy and establish care with an OB or midwife.', 'medical', 1, true, null, null),
  ('expecting_t1', 'First Trimester', 'Start prenatal vitamins', 'Folic acid is critical in the first trimester.', 'nutrition', 2, true, null, null),
  ('expecting_t1', 'First Trimester', 'Schedule genetic/chromosomal screening', 'NIPT or nuchal translucency ultrasound typically at 10-13 weeks.', 'medical', 3, true, null, null),
  ('expecting_t1', 'First Trimester', 'Avoid alcohol, smoking, and raw foods', 'Discuss all medications and supplements with your provider.', 'safety', 4, true, null, null),

-- Expecting T2 — Universal templates
  ('expecting_t2', 'Second Trimester', 'Schedule anatomy ultrasound (20-week scan)', 'Detailed scan of baby''s organs and anatomy.', 'medical', 1, true, null, null),
  ('expecting_t2', 'Second Trimester', 'Complete glucose screening test', 'Gestational diabetes screening typically at 24-28 weeks.', 'medical', 2, true, null, null),
  ('expecting_t2', 'Second Trimester', 'Research childbirth classes', 'Lamaze, Bradley, or hospital-specific classes.', 'general', 3, true, null, null),
  ('expecting_t2', 'Second Trimester', 'Begin planning your birth preferences', 'Consider your preferences for labor, pain management, and delivery.', 'general', 4, true, null, null),

-- Expecting T3 — Universal templates
  ('expecting_t3', 'Third Trimester', 'Schedule 36-week Group B Strep test', 'Vaginal/rectal swab to check for GBS bacteria.', 'medical', 1, true, null, null),
  ('expecting_t3', 'Third Trimester', 'Prepare your hospital bag', 'Pack by 36 weeks — ID, insurance, baby clothes, toiletries.', 'general', 2, true, null, null),
  ('expecting_t3', 'Third Trimester', 'Install and inspect infant car seat', 'Must be installed before baby arrives. Many fire stations offer free checks.', 'safety', 3, true, null, null),
  ('expecting_t3', 'Third Trimester', 'Choose a pediatrician', 'Interview and select your baby''s doctor before birth.', 'medical', 4, true, null, null),
  ('expecting_t3', 'Third Trimester', 'Count baby''s kick counts daily', 'Aim for 10 movements within 2 hours. Report concerns to your provider.', 'milestone', 5, true, null, null),

-- ============================================================
-- REMINDER TRIGGER TEMPLATES
-- These are the time-sensitive banners shown by AppointmentReminders.tsx
-- Each stage key maps to a single actionable reminder card.
-- ============================================================

-- Reminder: First Trimester Prenatal (weeks 1–13)
  ('reminder_prenatal_t1', 'First Trimester', 'Schedule your first prenatal visit', 'Your first OB appointment establishes your due date, baseline labs, and prenatal care plan. Call your provider today to book.', 'medical', 1, true, null, null),

-- Reminder: Birth Plan Check-in (weeks 20–32)
  ('reminder_birth_plan', 'Birth Plan Check-in', 'Complete your birth plan', 'Between weeks 24–32 is the ideal time to discuss your labor preferences, pain management options, and delivery environment with your care team.', 'general', 1, true, null, null),

-- Reminder: 48hr Post-Discharge
  ('reminder_48hr_postdischarge', '48hr Post-Discharge', 'Call your OB within 48 hours of discharge', 'Your care team needs a quick check-in call after you leave the hospital to monitor for postpartum warning signs and answer any questions.', 'medical', 1, true, null, null),

-- Reminder: 3-Week Postpartum Check-in
  ('reminder_3wk_postpartum', '3-Week Postpartum', 'Schedule your postpartum check-in', 'Book your 3-week postpartum visit to review physical recovery, mental health, and breastfeeding. This is in addition to your 6-week OB visit.', 'medical', 1, true, null, null),

-- Reminder: Pediatrician schedule (after 21 days)
  ('reminder_pediatrician_schedule', 'Pediatrician Schedule', 'Stay on track with pediatrician visits', 'Your baby should see their pediatrician at 1 month, 2 months, 4 months, 6 months, and 9 months. Call to confirm your next appointment is scheduled.', 'medical', 1, true, null, null)

ON CONFLICT DO NOTHING;
