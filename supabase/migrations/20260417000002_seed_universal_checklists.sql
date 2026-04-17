-- 20260417000002_seed_universal_checklists.sql
-- SOW 4.1: Pre-populated universal care checklist templates

-- ═══════════════════════════════════════
-- EXPECTING — Trimester 1
-- ═══════════════════════════════════════
INSERT INTO public.care_checklist_templates (stage, stage_label, title, description, category, sort_order) VALUES
('expecting_t1', 'First Trimester', 'Schedule first prenatal appointment', 'Confirm pregnancy and establish prenatal care with your OB/GYN or midwife.', 'medical', 1),
('expecting_t1', 'First Trimester', 'Start prenatal vitamins', 'Begin taking folic acid and prenatal vitamins daily as recommended by your provider.', 'nutrition', 2),
('expecting_t1', 'First Trimester', 'Schedule NT scan (11-13 weeks)', 'Nuchal translucency screening to assess early development.', 'medical', 3),
('expecting_t1', 'First Trimester', 'Research childbirth classes', 'Look into local or online childbirth education programs to prepare for delivery.', 'milestone', 4);

-- ═══════════════════════════════════════
-- EXPECTING — Trimester 2
-- ═══════════════════════════════════════
INSERT INTO public.care_checklist_templates (stage, stage_label, title, description, category, sort_order) VALUES
('expecting_t2', 'Second Trimester', 'Schedule anatomy scan (18-20 weeks)', 'Comprehensive ultrasound to check baby''s development and anatomy.', 'medical', 1),
('expecting_t2', 'Second Trimester', 'Start a birth plan', 'Discuss your preferences for labor, delivery, and postpartum care with your provider.', 'milestone', 2),
('expecting_t2', 'Second Trimester', 'Register for childbirth class', 'Enroll in a class to learn breathing techniques, labor stages, and newborn care basics.', 'milestone', 3),
('expecting_t2', 'Second Trimester', 'Begin nursery planning', 'Start setting up the baby''s room — crib, changing station, and essentials.', 'safety', 4),
('expecting_t2', 'Second Trimester', 'Schedule glucose screening (24-28 weeks)', 'Gestational diabetes test typically performed in the second trimester.', 'medical', 5);

-- ═══════════════════════════════════════
-- EXPECTING — Trimester 3
-- ═══════════════════════════════════════
INSERT INTO public.care_checklist_templates (stage, stage_label, title, description, category, sort_order) VALUES
('expecting_t3', 'Third Trimester', 'Pack hospital bag', 'Prepare essentials for mom, partner, and baby for hospital stay.', 'milestone', 1),
('expecting_t3', 'Third Trimester', 'Install car seat', 'Have the car seat properly installed and inspected before the due date.', 'safety', 2),
('expecting_t3', 'Third Trimester', 'Tour hospital or birth center', 'Familiarize yourself with the delivery facility and pre-register.', 'milestone', 3),
('expecting_t3', 'Third Trimester', 'Finalize pediatrician selection', 'Choose a pediatrician for your newborn''s first visit after birth.', 'medical', 4),
('expecting_t3', 'Third Trimester', 'Prepare postpartum recovery plan', 'Stock up on postpartum supplies and arrange help for the first few weeks.', 'milestone', 5);

-- ═══════════════════════════════════════
-- NEWBORN — 0-3 Months
-- ═══════════════════════════════════════
INSERT INTO public.care_checklist_templates (stage, stage_label, title, description, category, sort_order) VALUES
('newborn_0_3m', 'Newborn (0-3 months)', 'Schedule 2-week checkup', 'First pediatric visit to check weight gain, jaundice, and feeding.', 'medical', 1),
('newborn_0_3m', 'Newborn (0-3 months)', 'Schedule 1-month well-baby visit', 'Routine wellness check including growth measurement and developmental assessment.', 'medical', 2),
('newborn_0_3m', 'Newborn (0-3 months)', 'Schedule 2-month immunizations', 'First round of vaccinations including DTaP, IPV, Hib, HepB, PCV13, and Rotavirus.', 'medical', 3),
('newborn_0_3m', 'Newborn (0-3 months)', 'Start daily tummy time', 'Begin with a few minutes daily on a firm surface to build neck and core strength.', 'milestone', 4),
('newborn_0_3m', 'Newborn (0-3 months)', 'Establish feeding routine', 'Work with your provider or lactation consultant to set a consistent feeding schedule.', 'nutrition', 5),
('newborn_0_3m', 'Newborn (0-3 months)', 'Safe sleep setup verified', 'Ensure crib follows safe sleep guidelines — firm mattress, no loose bedding, on back.', 'safety', 6);

-- ═══════════════════════════════════════
-- INFANT — 3-6 Months
-- ═══════════════════════════════════════
INSERT INTO public.care_checklist_templates (stage, stage_label, title, description, category, sort_order) VALUES
('infant_3_6m', 'Infant (3-6 months)', 'Schedule 4-month checkup', 'Routine wellness visit and second round of immunizations.', 'medical', 1),
('infant_3_6m', 'Infant (3-6 months)', 'Discuss solid food readiness', 'Talk to your pediatrician about signs of readiness for introducing solids.', 'nutrition', 2),
('infant_3_6m', 'Infant (3-6 months)', 'Baby-proof main living areas', 'Cover outlets, secure furniture, and remove choking hazards from reach.', 'safety', 3),
('infant_3_6m', 'Infant (3-6 months)', 'Schedule 6-month dental check', 'First dental visit recommended within 6 months of first tooth or by age 1.', 'medical', 4),
('infant_3_6m', 'Infant (3-6 months)', 'Track developmental milestones', 'Watch for rolling, reaching, babbling, and social smiling.', 'milestone', 5);

-- ═══════════════════════════════════════
-- INFANT — 6-12 Months
-- ═══════════════════════════════════════
INSERT INTO public.care_checklist_templates (stage, stage_label, title, description, category, sort_order) VALUES
('infant_6_12m', 'Infant (6-12 months)', 'Schedule 9-month checkup', 'Developmental screening and growth assessment.', 'medical', 1),
('infant_6_12m', 'Infant (6-12 months)', 'Schedule 12-month immunizations', 'MMR, Varicella, HepA, and booster doses.', 'medical', 2),
('infant_6_12m', 'Infant (6-12 months)', 'CPR certification for caregivers', 'Complete an infant/child CPR and first aid course.', 'safety', 3),
('infant_6_12m', 'Infant (6-12 months)', 'Transition to sippy cup', 'Begin introducing a sippy cup alongside breastfeeding or bottle feeding.', 'nutrition', 4),
('infant_6_12m', 'Infant (6-12 months)', 'Introduce variety of solid foods', 'Offer a range of textures and flavors — fruits, vegetables, proteins, grains.', 'nutrition', 5);

-- ═══════════════════════════════════════
-- TODDLER — 12-24 Months
-- ═══════════════════════════════════════
INSERT INTO public.care_checklist_templates (stage, stage_label, title, description, category, sort_order) VALUES
('toddler_12_24m', 'Toddler (1-2 years)', 'Schedule 15-month checkup', 'Routine wellness visit and any catch-up immunizations.', 'medical', 1),
('toddler_12_24m', 'Toddler (1-2 years)', 'Schedule 18-month checkup', 'Developmental screening including autism spectrum assessment.', 'medical', 2),
('toddler_12_24m', 'Toddler (1-2 years)', 'Evaluate speech development', 'Discuss first words and language milestones with your pediatrician.', 'milestone', 3),
('toddler_12_24m', 'Toddler (1-2 years)', 'Update childproofing for mobility', 'Re-assess safety as toddler climbs, walks, and explores more areas.', 'safety', 4),
('toddler_12_24m', 'Toddler (1-2 years)', 'Establish consistent meal schedule', 'Move to 3 meals and 2 snacks daily with age-appropriate portions.', 'nutrition', 5);
