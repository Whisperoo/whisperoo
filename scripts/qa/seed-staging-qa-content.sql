-- ============================================================================
-- QA SEED, PART 2: EXPERTS + CONTENT + ENGAGEMENT -- STAGING ONLY.
--
--   Production ref: wznevejkaefokgibkknt   <-- never
--   Staging ref:    auttveumgltfedjptwfw   <-- this is the target
--
-- Run scripts/qa/seed-staging-qa.sql FIRST -- this depends on the tenant and
-- profiles it creates.
--
-- Part 1 gave the dashboard enough to make the segment selector move. This adds
-- the rest of the surface so an end-to-end pass has something real to click:
--
--   5 experts   -- visible on the experts directory, one tied to QA Test Hospital
--   9 products  -- paid, free, hospital resources and consultations, across
--                  both segments, in en/es/vi where the columns exist
--   analytics   -- views / downloads / saves, so Resource Utilization is not empty
--   purchases   -- so revenue and "resources purchased" report real numbers
--   bookings    -- so the appointment engagement KPI is non-zero
--   chat        -- sessions and messages, one flagged, so escalation % and
--                  concern themes have something to chart
--
-- Engagement is split deliberately across hospital and B2C users so every
-- segment-filtered number changes when you switch the selector -- that is the
-- thing worth QA-ing, and it cannot be checked against uniform data.
--
-- NOTE: sessions.user_id and messages have no parent_id -- this matches the
-- REAL production schema, which differs from what the migration files build.
--
-- Idempotent. Undo with scripts/qa/cleanup-staging-qa.sql, which removes
-- everything on the 'facade00-' prefix.
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- Same heuristic guard as part 1: refuse to run against anything that looks real.
DO $$
DECLARE v_real int;
BEGIN
  SELECT COUNT(*) INTO v_real FROM public.profiles WHERE id::text NOT LIKE 'facade00-%';
  IF v_real > 50 THEN
    RAISE EXCEPTION 'ABORTED: % non-QA profiles found. This is not staging.', v_real;
  END IF;
END $$;

-- Part 1 must have run.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = 'facade00-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'ABORTED: run scripts/qa/seed-staging-qa.sql first (QA Test Hospital not found).';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Experts (profiles with account_type = 'expert')
--    Specialties are drawn from the real taxonomy so expert matching in chat
--    has something plausible to rank.
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email, aud, role)
SELECT u.id, u.email, 'authenticated', 'authenticated'
FROM (VALUES
  ('facade00-0000-4000-8000-0000000000e1'::uuid, 'qa.expert.1@qa.invalid'),
  ('facade00-0000-4000-8000-0000000000e2'::uuid, 'qa.expert.2@qa.invalid'),
  ('facade00-0000-4000-8000-0000000000e3'::uuid, 'qa.expert.3@qa.invalid'),
  ('facade00-0000-4000-8000-0000000000e4'::uuid, 'qa.expert.4@qa.invalid'),
  ('facade00-0000-4000-8000-0000000000e5'::uuid, 'qa.expert.5@qa.invalid')
) AS u(id, email)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (
  id, first_name, account_type, onboarded, tenant_id,
  expert_bio, expert_bio_es, expert_bio_vi,
  expert_specialties, expert_credentials, expert_experience_years,
  expert_consultation_rate, expert_availability_status, expert_verified,
  expert_rating, expert_total_reviews, expert_profile_visibility,
  expert_accepts_new_clients, expert_languages, expert_response_time_hours
)
SELECT e.id, e.name, 'expert', true, e.tenant,
       e.bio, e.bio_es, e.bio_vi,
       e.specialties, ARRAY[e.creds], e.years, e.rate, 'available', true,
       e.rating, e.reviews, true, true, ARRAY['en','es'], 24
FROM (VALUES
  ('facade00-0000-4000-8000-0000000000e1'::uuid, 'QA Dana Whitfield',
   'facade00-0000-4000-8000-000000000001'::uuid,
   'Lactation consultant supporting families through the first months of feeding.',
   'Consultora de lactancia que acompana a las familias en los primeros meses.',
   'Chuyen gia tu van nuoi con bang sua me trong nhung thang dau.',
   ARRAY['Lactation','Breastfeeding'], 'IBCLC', 12, 120.00, 4.8, 34),

  ('facade00-0000-4000-8000-0000000000e2'::uuid, 'QA Priya Raman', NULL,
   'Paediatric sleep specialist focused on gentle, evidence-led routines.',
   'Especialista en sueno pediatrico centrada en rutinas suaves y con evidencia.',
   'Chuyen gia giac ngu nhi khoa, tap trung vao thoi quen nhe nhang.',
   ARRAY['Sleep Training','Sleep'], 'MSc Paediatric Sleep', 8, 95.00, 4.6, 21),

  ('facade00-0000-4000-8000-0000000000e3'::uuid, 'QA Marcus Bell', NULL,
   'Pelvic floor physiotherapist working with postpartum recovery.',
   'Fisioterapeuta de suelo pelvico especializado en recuperacion posparto.',
   'Chuyen gia vat ly tri lieu san chau, phuc hoi sau sinh.',
   ARRAY['Pelvic Floor','Physical Therapy'], 'DPT', 15, 140.00, 4.9, 52),

  ('facade00-0000-4000-8000-0000000000e4'::uuid, 'QA Sofia Marchetti',
   'facade00-0000-4000-8000-000000000001'::uuid,
   'Perinatal mental health counsellor. Anxiety, mood changes, adjustment.',
   'Consejera de salud mental perinatal. Ansiedad y cambios de animo.',
   'Tu van suc khoe tinh than chu sinh. Lo au va thay doi tam trang.',
   ARRAY['Emotional Support','Mental Health'], 'LCSW', 10, 110.00, 4.7, 40),

  ('facade00-0000-4000-8000-0000000000e5'::uuid, 'QA Tom Okafor', NULL,
   'Paediatric nutritionist covering weaning, allergies and fussy eating.',
   'Nutricionista pediatrico: destete, alergias y alimentacion selectiva.',
   'Chuyen gia dinh duong nhi: an dam, di ung va bieng an.',
   ARRAY['Nutrition','Diet'], 'RD', 6, 85.00, 4.4, 17)
) AS e(id, name, tenant, bio, bio_es, bio_vi, specialties, creds, years, rate, rating, reviews)
-- The on_auth_user_created trigger already created a bare profiles row for each
-- auth.users insert above, so this must UPDATE rather than DO NOTHING -- otherwise
-- every expert field silently stays null and no expert appears in the directory.
ON CONFLICT (id) DO UPDATE SET
  first_name                = EXCLUDED.first_name,
  account_type              = EXCLUDED.account_type,
  onboarded                 = EXCLUDED.onboarded,
  tenant_id                 = EXCLUDED.tenant_id,
  expert_bio                = EXCLUDED.expert_bio,
  expert_bio_es             = EXCLUDED.expert_bio_es,
  expert_bio_vi             = EXCLUDED.expert_bio_vi,
  expert_specialties        = EXCLUDED.expert_specialties,
  expert_credentials        = EXCLUDED.expert_credentials,
  expert_experience_years   = EXCLUDED.expert_experience_years,
  expert_consultation_rate  = EXCLUDED.expert_consultation_rate,
  expert_availability_status= EXCLUDED.expert_availability_status,
  expert_verified           = EXCLUDED.expert_verified,
  expert_rating             = EXCLUDED.expert_rating,
  expert_total_reviews      = EXCLUDED.expert_total_reviews,
  expert_profile_visibility = EXCLUDED.expert_profile_visibility,
  expert_accepts_new_clients= EXCLUDED.expert_accepts_new_clients,
  expert_languages          = EXCLUDED.expert_languages,
  expert_response_time_hours= EXCLUDED.expert_response_time_hours;

-- ---------------------------------------------------------------------------
-- 2. Products / resources
--    product_type must be one of video|document|audio|course|consultation and
--    content_type one of single|bundle|course|collection (CHECK constraints).
--    Mix of paid, free, hospital-scoped and consultation types so the Content
--    tab, the marketplace and the resource metrics all have variety.
-- ---------------------------------------------------------------------------
INSERT INTO public.products (
  id, expert_id, title, description, price, product_type, content_type,
  is_active, is_free, is_hospital_resource, tenant_id, status,
  title_es, title_vi, tags, created_at
)
SELECT p.id, p.expert, p.title, p.descr, p.price, p.ptype, p.ctype,
       true, p.is_free, p.is_hosp, p.tenant, 'published',
       p.title_es, p.title_vi, p.tags, now() - (p.days || ' days')::interval
FROM (VALUES
  ('facade00-0000-4000-8000-0000000000d1'::uuid, 'facade00-0000-4000-8000-0000000000e1'::uuid,
   'First Weeks of Breastfeeding', 'A practical guide to the first six weeks.',
   19.00, 'document', 'single', false, false, NULL::uuid,
   'Primeras semanas de lactancia', 'Nhung tuan dau cho con bu', ARRAY['Lactation'], 26),

  ('facade00-0000-4000-8000-0000000000d2'::uuid, 'facade00-0000-4000-8000-0000000000e2'::uuid,
   'Gentle Sleep Foundations', 'Building sleep routines without cry-it-out.',
   29.00, 'document', 'single', false, false, NULL,
   'Bases del sueno suave', 'Nen tang giac ngu nhe nhang', ARRAY['Sleep Training'], 24),

  ('facade00-0000-4000-8000-0000000000d3'::uuid, 'facade00-0000-4000-8000-0000000000e3'::uuid,
   'Postpartum Core Recovery', 'Six-week pelvic floor programme.',
   39.00, 'video', 'single', false, false, NULL,
   'Recuperacion posparto', 'Phuc hoi co san chau sau sinh', ARRAY['Pelvic Floor'], 21),

  ('facade00-0000-4000-8000-0000000000d4'::uuid, 'facade00-0000-4000-8000-0000000000e4'::uuid,
   'When to Ask for Help', 'Recognising perinatal anxiety and low mood.',
   0.00, 'document', 'single', true, false, NULL,
   'Cuando pedir ayuda', 'Khi nao can giup do', ARRAY['Emotional Support'], 18),

  ('facade00-0000-4000-8000-0000000000d5'::uuid, 'facade00-0000-4000-8000-0000000000e5'::uuid,
   'Starting Solids Safely', 'Weaning timelines and allergen introduction.',
   0.00, 'document', 'single', true, false, NULL,
   'Empezar con solidos', 'Bat dau an dam an toan', ARRAY['Nutrition'], 15),

  ('facade00-0000-4000-8000-0000000000d6'::uuid, 'facade00-0000-4000-8000-0000000000e1'::uuid,
   'QA Hospital: Discharge Feeding Checklist', 'Given to families at discharge.',
   0.00, 'document', 'single', true, true, 'facade00-0000-4000-8000-000000000001',
   'Lista de alta: alimentacion', 'Danh sach xuat vien', ARRAY['Lactation'], 12),

  ('facade00-0000-4000-8000-0000000000d7'::uuid, 'facade00-0000-4000-8000-0000000000e4'::uuid,
   'QA Hospital: Postpartum Support Line', 'Direct line to the QA Test Hospital team.',
   0.00, 'document', 'single', true, true, 'facade00-0000-4000-8000-000000000001',
   'Linea de apoyo posparto', 'Duong day ho tro sau sinh', ARRAY['Emotional Support'], 9),

  ('facade00-0000-4000-8000-0000000000d8'::uuid, 'facade00-0000-4000-8000-0000000000e2'::uuid,
   'Sleep Consultation (60 min)', 'One-to-one video consultation.',
   95.00, 'consultation', 'single', false, false, NULL,
   'Consulta de sueno (60 min)', 'Tu van giac ngu (60 phut)', ARRAY['Sleep Training'], 7),

  ('facade00-0000-4000-8000-0000000000d9'::uuid, 'facade00-0000-4000-8000-0000000000e3'::uuid,
   'Pelvic Floor Assessment', 'Initial assessment and plan.',
   140.00, 'consultation', 'single', false, false, NULL,
   'Evaluacion de suelo pelvico', 'Danh gia co san chau', ARRAY['Pelvic Floor'], 4)
) AS p(id, expert, title, descr, price, ptype, ctype, is_free, is_hosp, tenant, title_es, title_vi, tags, days)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Product analytics -- feeds Resource Utilization (views / downloads / saves)
--    Deliberately lopsided between hospital and B2C users so the numbers move
--    when the segment changes.
-- ---------------------------------------------------------------------------
INSERT INTO public.product_analytics (id, product_id, user_id, event_type, created_at)
SELECT ('facade00-0000-4000-8000-' || lpad((900000000000 + row_number() OVER ())::text, 12, '0'))::uuid,
       a.product, a.usr, a.evt, now() - (a.days || ' days')::interval
FROM (VALUES
  -- hospital users engaging
  ('facade00-0000-4000-8000-0000000000d1'::uuid,'facade00-0000-4000-8000-000000000011'::uuid,'view',2),
  ('facade00-0000-4000-8000-0000000000d1','facade00-0000-4000-8000-000000000012','view',3),
  ('facade00-0000-4000-8000-0000000000d1','facade00-0000-4000-8000-000000000011','download',2),
  ('facade00-0000-4000-8000-0000000000d6','facade00-0000-4000-8000-000000000013','view',4),
  ('facade00-0000-4000-8000-0000000000d6','facade00-0000-4000-8000-000000000014','view',5),
  ('facade00-0000-4000-8000-0000000000d6','facade00-0000-4000-8000-000000000013','download',4),
  ('facade00-0000-4000-8000-0000000000d7','facade00-0000-4000-8000-000000000015','view',6),
  ('facade00-0000-4000-8000-0000000000d2','facade00-0000-4000-8000-000000000016','view',7),
  -- B2C users engaging
  ('facade00-0000-4000-8000-0000000000d2','facade00-0000-4000-8000-000000000021','view',3),
  ('facade00-0000-4000-8000-0000000000d2','facade00-0000-4000-8000-000000000021','download',3),
  ('facade00-0000-4000-8000-0000000000d3','facade00-0000-4000-8000-000000000022','view',8),
  ('facade00-0000-4000-8000-0000000000d4','facade00-0000-4000-8000-000000000023','view',10),
  ('facade00-0000-4000-8000-0000000000d5','facade00-0000-4000-8000-000000000024','view',11),
  ('facade00-0000-4000-8000-0000000000d5','facade00-0000-4000-8000-000000000024','download',11),
  -- anonymous traffic (user_id NULL) -- only counted under the 'all' segment
  ('facade00-0000-4000-8000-0000000000d1',NULL,'view',5),
  ('facade00-0000-4000-8000-0000000000d4',NULL,'view',9)
) AS a(product, usr, evt, days)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Purchases -- revenue + "resources purchased" KPI
-- ---------------------------------------------------------------------------
INSERT INTO public.purchases (id, user_id, product_id, expert_id, amount, currency, status, purchased_at)
SELECT p.id, p.usr, p.product, p.expert, p.amount, 'usd', 'completed',
       now() - (p.days || ' days')::interval
FROM (VALUES
  ('facade00-0000-4000-8000-0000000000c1'::uuid,'facade00-0000-4000-8000-000000000011'::uuid,
   'facade00-0000-4000-8000-0000000000d1'::uuid,'facade00-0000-4000-8000-0000000000e1'::uuid,19.00,2),
  ('facade00-0000-4000-8000-0000000000c2','facade00-0000-4000-8000-000000000012',
   'facade00-0000-4000-8000-0000000000d3','facade00-0000-4000-8000-0000000000e3',39.00,6),
  ('facade00-0000-4000-8000-0000000000c3','facade00-0000-4000-8000-000000000021',
   'facade00-0000-4000-8000-0000000000d2','facade00-0000-4000-8000-0000000000e2',29.00,4),
  ('facade00-0000-4000-8000-0000000000c4','facade00-0000-4000-8000-000000000022',
   'facade00-0000-4000-8000-0000000000d3','facade00-0000-4000-8000-0000000000e3',39.00,9)
) AS p(id, usr, product, expert, amount, days)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Consultation bookings -- appointment engagement KPI
--    booking_type is direct|inquiry; payment state lives in payment_status
--    (unpaid|paid|free|refunded) and resource_type is whisperoo|hospital.
-- ---------------------------------------------------------------------------
INSERT INTO public.consultation_bookings (
  id, user_id, user_email, user_name, expert_id, expert_name,
  product_id, appointment_name, booking_type, amount_paid, status, payment_status,
  resource_type, booked_at, created_at
)
SELECT b.id, b.usr, b.email, b.uname, b.expert, b.ename, b.product,
       b.appt, 'direct', b.amount, b.status, 'paid', 'whisperoo',
       now() - (b.days || ' days')::interval, now() - (b.days || ' days')::interval
FROM (VALUES
  ('facade00-0000-4000-8000-0000000000b1'::uuid,'facade00-0000-4000-8000-000000000011'::uuid,
   'qa.hospital.1@qa.invalid','QA Hospital One','facade00-0000-4000-8000-0000000000e2'::uuid,'QA Priya Raman',
   'facade00-0000-4000-8000-0000000000d8'::uuid,'Sleep Consultation (60 min)',95.00,'confirmed',5),
  ('facade00-0000-4000-8000-0000000000b2','facade00-0000-4000-8000-000000000013',
   'qa.hospital.3@qa.invalid','QA Hospital Three','facade00-0000-4000-8000-0000000000e3','QA Marcus Bell',
   'facade00-0000-4000-8000-0000000000d9','Pelvic Floor Assessment',140.00,'completed',12),
  ('facade00-0000-4000-8000-0000000000b3','facade00-0000-4000-8000-000000000022',
   'qa.b2c.2@qa.invalid','QA Direct Two','facade00-0000-4000-8000-0000000000e2','QA Priya Raman',
   'facade00-0000-4000-8000-0000000000d8','Sleep Consultation (60 min)',95.00,'confirmed',8)
) AS b(id, usr, email, uname, expert, ename, product, appt, amount, status, days)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Chat sessions and messages -- escalation %, DAU/MAU, concern themes
--    One message is flagged so the escalation rate is non-zero and the
--    flagged-review queue has something in it.
--    NOTE: sessions.user_id (production shape), messages have no parent_id.
-- ---------------------------------------------------------------------------
INSERT INTO public.sessions (id, user_id, title, summary, created_at, last_message_at, is_active)
SELECT s.id, s.usr, s.title, s.summary,
       now() - (s.days || ' days')::interval, now() - (s.days || ' days')::interval, true
FROM (VALUES
  ('facade00-0000-4000-8000-0000000000f1'::uuid,'facade00-0000-4000-8000-000000000011'::uuid,
   'Feeding overnight','Parent asking about cluster feeding at night.',2),
  ('facade00-0000-4000-8000-0000000000f2','facade00-0000-4000-8000-000000000013',
   'Sleep regression','Four month sleep regression questions.',5),
  ('facade00-0000-4000-8000-0000000000f3','facade00-0000-4000-8000-000000000021',
   'Feeling low','Parent describing persistent low mood.',3),
  ('facade00-0000-4000-8000-0000000000f4','facade00-0000-4000-8000-000000000023',
   'Starting solids','Questions about allergen introduction.',7)
) AS s(id, usr, title, summary, days)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.messages (id, session_id, role, content, metadata, is_flagged_for_review, created_at)
SELECT ('facade00-0000-4000-8000-' || lpad((800000000000 + row_number() OVER ())::text, 12, '0'))::uuid,
       m.session, m.role, m.content,
       jsonb_build_object('detected_category', m.category, 'qa_seed', true),
       m.flagged, now() - (m.days || ' days')::interval
FROM (VALUES
  ('facade00-0000-4000-8000-0000000000f1'::uuid,'user','Is it normal to feed every hour at night?','Breastfeeding',false,2),
  ('facade00-0000-4000-8000-0000000000f1','assistant','Cluster feeding overnight is common in the early weeks.','Breastfeeding',false,2),
  ('facade00-0000-4000-8000-0000000000f2','user','My baby wakes every 90 minutes since four months.','Sleep Training',false,5),
  ('facade00-0000-4000-8000-0000000000f2','assistant','That timing is consistent with the four month sleep regression.','Sleep Training',false,5),
  -- flagged: drives escalation % and the review queue
  ('facade00-0000-4000-8000-0000000000f3','user','I have felt hopeless for weeks and cannot enjoy anything.','Emotional Support',true,3),
  ('facade00-0000-4000-8000-0000000000f3','assistant','Thank you for telling me. Please contact your provider today.','Emotional Support',false,3),
  ('facade00-0000-4000-8000-0000000000f4','user','When can I introduce peanut safely?','Nutrition',false,7),
  ('facade00-0000-4000-8000-0000000000f4','assistant','Guidance suggests introducing allergens early. Confirm with your paediatrician.','Nutrition',false,7)
) AS m(session, role, content, category, flagged, days)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
SELECT 'experts'   AS seeded, COUNT(*) FROM public.profiles WHERE account_type='expert' AND id::text LIKE 'facade00-%'
UNION ALL SELECT 'products',  COUNT(*) FROM public.products             WHERE id::text LIKE 'facade00-%'
UNION ALL SELECT 'analytics', COUNT(*) FROM public.product_analytics    WHERE id::text LIKE 'facade00-%'
UNION ALL SELECT 'purchases', COUNT(*) FROM public.purchases            WHERE id::text LIKE 'facade00-%'
UNION ALL SELECT 'bookings',  COUNT(*) FROM public.consultation_bookings WHERE id::text LIKE 'facade00-%'
UNION ALL SELECT 'sessions',  COUNT(*) FROM public.sessions             WHERE id::text LIKE 'facade00-%'
UNION ALL SELECT 'messages',  COUNT(*) FROM public.messages             WHERE id::text LIKE 'facade00-%'
ORDER BY 1;
