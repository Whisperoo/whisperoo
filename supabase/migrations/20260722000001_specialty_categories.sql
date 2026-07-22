-- Admin-manageable chat topic taxonomy (Sprint 2 follow-up, Phase 2).
--
-- Unifies two taxonomies that were previously hardcoded and duplicated
-- across 4 places inside chat_ai_rag_fixed/index.ts:
--   1. detectMessageCategory  — 9 categories, used for messages.metadata.category
--      (admin AI Audit Trail + Concern Themes chart) and recurring-topic detection.
--   2. SPECIALTY_KEYWORDS     — 8 groups, used only for the keyword-fallback
--      expert search when semantic matching misses.
-- These had different names/groupings for the same real-world topics and
-- different (non-overlapping) keyword lists for the same topic — e.g. the
-- Baby Feeding category's detection keywords didn't include "mastitis" or
-- "clogged duct" (only present in the keyword-fallback list), and the
-- Nervous System Regulation category's detection keywords weren't all present
-- in the keyword-fallback "Family Dynamics" group. `keywords` below is the
-- UNION of both original lists per topic so neither detection nor expert
-- matching loses coverage. Two categories (Nutrition, Chiropractic) existed
-- only in the keyword-fallback system — those messages could match an expert
-- but were never analytics-tagged; they're now full categories too.
--
-- sort_order controls detection-check order. Toddler Development MUST sort
-- before Pelvic Floor — both use bathroom/bladder vocabulary but are unrelated
-- (Pelvic Floor is the PARENT's body; Toddler Development is the CHILD's
-- toileting/behavior, and no specialist covers it) — this exact ordering is
-- what fixed the "potty training recommended a Pelvic Floor Specialist" bug.
-- sort_order does NOT affect the keyword-fallback expert search, which still
-- checks every active category independently (unordered), matching original
-- behavior where a message could match multiple specialty groups at once.
--
-- Deliberately out of scope: supabase/functions/_shared/topicAliases.ts
-- (onboarding-topic ranking bonus) and src/utils/canonicalTopics.ts (admin
-- product tagging) — separate systems from the chat-matching pipeline.

CREATE TABLE IF NOT EXISTS public.specialty_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  keywords text[] NOT NULL DEFAULT '{}',
  mapped_specialties text[] NOT NULL DEFAULT '{}', -- empty = "no specialist on the platform, general guidance only"
  seed_phrase text,
  prompt_notes text, -- optional disqualifier/guidance line(s) for the LLM prompt table; multiple lines separated by ' || '
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_specialty_categories_active_sort
  ON public.specialty_categories(is_active, sort_order);

DROP TRIGGER IF EXISTS update_specialty_categories_updated_at ON public.specialty_categories;
CREATE TRIGGER update_specialty_categories_updated_at
  BEFORE UPDATE ON public.specialty_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.specialty_categories ENABLE ROW LEVEL SECURITY;

-- Admin-only manage. The edge function reads via the service-role key, which
-- bypasses RLS entirely, so no separate read policy is needed for it.
DROP POLICY IF EXISTS "Admins can manage specialty categories" ON public.specialty_categories;
CREATE POLICY "Admins can manage specialty categories" ON public.specialty_categories
  FOR ALL USING (fn_caller_is_staff_admin()) WITH CHECK (fn_caller_is_staff_admin());

-- ── Seed: union of both prior hardcoded taxonomies ────────────────────────

INSERT INTO public.specialty_categories (name, keywords, mapped_specialties, seed_phrase, prompt_notes, sort_order) VALUES

('Baby Feeding', ARRAY[
  'breastfeeding', 'nursing', 'latch', 'milk supply', 'pumping', 'weaning', 'formula', 'lactation',
  'breastfeed', 'breastfed', 'breast feed', 'breast feeding', 'breast fed',
  'breast milk', 'breastmilk', 'nurse my baby', 'latching', 'latch on',
  'won''t latch', 'not latching', 'latch issues', 'latch problems', 'latch difficulties',
  'low milk', 'milk production', 'not enough milk', 'drying up', 'dry up',
  'increase milk', 'boost milk', 'nipple', 'nipple pain', 'sore nipple', 'cracked nipple',
  'mastitis', 'breast infection', 'clogged duct', 'blocked duct', 'engorged', 'engorgement',
  'lactation consultant', 'colostrum', 'pump', 'pumped', 'breast pump',
  'wean', 'stop breastfeeding', 'formula feeding', 'bottle feeding',
  'bottle feed', 'bottle', 'feeding my baby', 'baby feeding', 'feeding issues', 'feeding problems',
  'feeding difficulties',
  'sữa mẹ', 'cho bú', 'bú mẹ', 'ti mẹ', 'hút sữa', 'tắc tia sữa', 'cai sữa', 'cho con bú', 'bú sữa',
  'lactancia', 'amamantar', 'pecho', 'leche materna', 'dar el pecho', 'lactación', 'sacaleches', 'extractor de leche'
], ARRAY['Breastfeeding', 'Lactation', 'Feeding', 'Baby Feeding'],
'breastfeeding latch milk supply nursing pumping bottle formula',
'NOT a Dietitian (dietitians handle what the parent eats, NOT baby feeding technique)',
10),

('Nervous System Regulation', ARRAY[
  'depress', 'anxiet', 'hopeless', 'worthless', 'mental health', 'overwhelmed', 'overwhelming',
  'postpartum depression', 'ppd', 'postpartum anxiety', 'self-harm', 'harm', 'suicide',
  'nervous system', 'stress', 'stressed', 'stressful', 'regulation', 'anxiety', 'anxious',
  'relationship', 'partner', 'husband', 'spouse', 'marriage', 'family dynamics', 'identity', 'balance',
  'can''t manage', 'struggling to manage', 'hard to manage', 'struggling', 'struggle',
  'too much to handle', 'too much on my plate', 'can''t cope', 'hard to cope', 'feeling lost',
  'exhausted', 'exhaustion', 'so tired', 'burned out', 'burnout',
  'housework', 'house work', 'chores', 'managing everything', 'responsibilities', 'do it all',
  'can''t do it all', 'life after baby', 'adjustment', 'adjusting',
  'new mom', 'new parent', 'new mother', 'first time mom', 'self care', 'self-care',
  'mom guilt', 'guilt', 'lost my identity', 'not myself', 'finding balance',
  'feeling alone', 'lonely', 'isolated', 'overwhelmed with baby',
  'căng thẳng', 'lo lắng', 'kiệt sức', 'mệt mỏi', 'cảm thấy cô đơn',
  'estrés', 'ansiedad', 'depresión posparto', 'agotada', 'abrumada'
], ARRAY['Family Dynamics', 'Lifestyle', 'Emotional Support'],
'stress overwhelmed anxiety regulation postpartum emotions support',
NULL, 20),

('Toddler Development', ARRAY[
  'potty', 'toilet training', 'toddler tantrum', 'tantrum', 'discipline', 'time out', 'time-out',
  'developmental milestone', 'milestones',
  'tập đi vệ sinh', 'bô',
  'control de esfínteres', 'rabieta', 'berrinche'
], ARRAY[]::text[],
NULL,
'Do NOT recommend a Pelvic Floor Specialist here || Answer with general parenting guidance only and do NOT include any expert recommendation for this topic',
30),

('Pelvic Floor', ARRAY[
  'pelvic floor', 'pelvic pain', 'diastasis', 'c-section scar', 'kegel', 'prolapse', 'core rehab',
  'incontinence', 'perineal', 'leaking urine',
  'pee', 'peed', 'peeing', 'leak', 'leaking', 'leaks',
  'pelvic', 'pelvic pressure', 'sneeze', 'bladder',
  'diastasis recti', 'ab separation', 'core recovery',
  'perineum', 'vaginal pressure', 'vaginal pain',
  'c-section', 'csection', 'c section', 'cesarean', 'scar tissue',
  'postpartum physical', 'postpartum healing', 'birth recovery', 'bleeding', 'lochia', 'after birth', 'recovery',
  'core strength after baby', 'pelvic floor weakness',
  'sàn chậu', 'tiểu không kiểm soát', 'rỉ nước tiểu', 'mổ lấy thai',
  'suelo pélvico', 'pérdidas de orina', 'cesárea'
], ARRAY['Pelvic Floor', 'Pelvic Health', 'Postpartum Recovery'],
'pelvic floor postpartum recovery leaking incontinence prolapse diastasis',
'NOT for general emotions or life management || NOT for the child''s potty/toilet training — Pelvic Floor is the PARENT''s own body (bladder control, C-section healing, diastasis), never the child''s toileting or behavior, even though both use bathroom/bladder words',
40),

('Sleep Coaching', ARRAY[
  'sleep', 'nap', 'napping', 'bedtime', 'bed time',
  'night waking', 'night wakes', 'wakes up at night', 'waking up at night',
  'wake up', 'wakes up', 'waking up',
  'sleep training', 'sleep train', 'cry it out', 'ferber',
  'sleep regression', 'regression',
  'won''t sleep', 'not sleeping', 'trouble sleeping', 'sleep issues', 'sleep problems',
  'won''t nap', 'skipping naps', 'fighting sleep', 'overtired', 'over tired',
  'co-sleeping', 'cosleeping', 'bed sharing', 'crying at night', 'up all night', 'all night',
  'ngủ', 'giấc ngủ', 'thức đêm', 'ru ngủ', 'không chịu ngủ',
  'dormir', 'sueño', 'siesta', 'no duerme', 'despertarse de noche'
], ARRAY['Sleep Training', 'Sleep', 'Infant Sleep'],
'baby sleep bedtime nap night waking sleep training regression',
NULL, 50),

('Fitness/yoga', ARRAY[
  'yoga', 'prenatal yoga', 'postnatal yoga',
  'prenatal exercise', 'postnatal exercise', 'postpartum exercise',
  'exercise', 'workout', 'working out', 'fitness', 'stretch', 'stretching',
  'mindfulness', 'breathing exercise', 'meditation',
  'get in shape', 'get back in shape', 'in shape', 'lose weight',
  'postpartum fitness', 'body after baby', 'toning',
  'tập thể dục', 'tập yoga', 'vận động', 'thở', 'thiền',
  'ejercicio', 'yoga prenatal', 'yoga posnatal', 'fitness posparto'
], ARRAY['Yoga', 'Prenatal Yoga', 'Postnatal Yoga', 'Postpartum Fitness'],
'postpartum exercise yoga stretching breathing mindfulness',
NULL, 60),

('Pediatric Dentistry', ARRAY[
  'teeth', 'tooth', 'dental', 'dentist', 'dentistry', 'brushing',
  'oral health', 'oral care', 'oral development',
  'teething', 'teething pain', 'teething symptoms',
  'gums', 'gum pain', 'gum health', 'cavity', 'cavities', 'tooth decay',
  'baby teeth', 'first teeth', 'milk teeth', 'permanent teeth',
  'tooth brushing', 'brushing teeth', 'toothbrush', 'toothpaste',
  'fluoride', 'orthodontics', 'airway', 'jaw development',
  'răng', 'nha khoa', 'mọc răng', 'đau răng',
  'dientes', 'dentista', 'encías', 'caries'
], ARRAY['Pediatric Oral Development', 'Pediatric Dentistry', 'Dental Health', 'Oral Health'],
'teething brushing teeth dentist cavities',
NULL, 70),

('Back to Work', ARRAY[
  'work', 'career', 'job', 'childcare', 'daycare', 'nanny'
], ARRAY[]::text[],
'return to work childcare daycare pumping at work schedule',
NULL, 80),

('Nutrition', ARRAY[
  'nutrition', 'nutritionist', 'dietitian', 'diet', 'meal', 'meals', 'meal plan', 'meal prep',
  'food', 'eating', 'eating habits', 'healthy eating',
  'protein', 'vitamin', 'vitamins', 'supplement', 'supplements',
  'calorie', 'calories', 'hydration', 'dehydrated',
  'prenatal nutrition', 'postpartum nutrition', 'weight loss', 'losing weight', 'postpartum weight',
  'hungry', 'appetite', 'cravings', 'iron', 'calcium', 'omega',
  'dinh dưỡng', 'chế độ ăn', 'ăn uống', 'thực phẩm',
  'nutrición', 'nutricionista', 'dietista', 'dieta', 'alimentación'
], ARRAY['Nutrition', 'Postpartum Nutrition', 'Prenatal Nutrition'],
'nutrition diet meal plan healthy eating vitamins supplements postpartum weight',
NULL, 90),

('Chiropractic', ARRAY[
  'chiropractic', 'chiropractor', 'alignment', 'misalignment', 'spine', 'spinal',
  'tension', 'tight muscles', 'neck tension',
  'colic', 'colicky', 'gassy baby', 'gas pain', 'reflux', 'acid reflux', 'spit up',
  'torticollis', 'head tilt', 'flat head', 'nervous system'
], ARRAY['Chiropractic', 'Pediatric Chiropractic'],
'chiropractic alignment spine tension colic reflux torticollis',
NULL, 100)

ON CONFLICT (name) DO NOTHING;
