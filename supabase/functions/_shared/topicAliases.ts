// Shared topic / expert-specialty alias normalization.
// Imported by the chat_ai_rag_fixed edge function (Deno) AND by
// the React hook src/hooks/usePersonalizedSort.ts (Vite). Keep
// this file portable — no Deno-only or Node-only imports.
//
// Single source of truth for "is this expert's specialty relevant
// to this user-selected onboarding topic?"

export const TOPIC_SLUG_MAP: Record<string, string[]> = {
  'Lactation':                 ['Lactation', 'lactation', 'baby-feeding', 'breastfeeding', 'nursing', 'latch'],
  'Baby Feeding':              ['Baby Feeding', 'baby-feeding', 'feeding', 'nutrition', 'breastfeeding', 'formula', 'lactation'],
  'Pelvic Floor':              ['Pelvic Floor', 'pelvic-floor', 'womens-health', 'pelvic-floor-coaching'],
  'Sleep Coaching':            ['Sleep Coaching', 'sleep-coaching', 'sleep', 'routines', 'nap-transitions', 'bedtime'],
  'Nervous System Regulation': ['Nervous System Regulation', 'nervous-system', 'mental-health', 'self-care', 'anxiety', 'stress-regulation'],
  'Nutrition':                 ['Nutrition', 'nutrition', 'dietitian', 'gut-health'],
  'Pediatric Dentistry':       ['Pediatric Dentistry', 'pediatric-dentistry', 'dental', 'pediatric', 'oral-health', 'teething'],
  'Lifestyle Coaching':        ['Lifestyle Coaching', 'lifestyle-coaching', 'lifestyle', 'coaching', 'productivity', 'organization'],
  'Fitness/yoga':              ['Fitness/yoga', 'fitness-yoga', 'fitness', 'yoga', 'exercise', 'prenatal-yoga'],
  'Back to Work':              ['Back to Work', 'back-to-work', 'career', 'work-life-balance'],
  'Postpartum Tips':           ['Postpartum Tips', 'postpartum-tips', 'postpartum', 'recovery', 'newborn-care'],
  'Prenatal Tips':             ['Prenatal Tips', 'prenatal-tips', 'prenatal', 'pregnancy', 'expecting', 'labor-prep', 'birth-plan'],
};

// Legacy translations / older topic strings that should map to a canonical key.
export const LEGACY_TOPIC_MAP: Record<string, string> = {
  // English (identity)
  'Lactation': 'Lactation',
  'Baby Feeding': 'Baby Feeding',
  'Pelvic Floor': 'Pelvic Floor',
  'Sleep Coaching': 'Sleep Coaching',
  'Nervous System Regulation': 'Nervous System Regulation',
  'Nutrition': 'Nutrition',
  'Pediatric Dentistry': 'Pediatric Dentistry',
  'Lifestyle Coaching': 'Lifestyle Coaching',
  'Fitness/yoga': 'Fitness/yoga',
  'Back to Work': 'Back to Work',
  'Postpartum Tips': 'Postpartum Tips',
  'Prenatal Tips': 'Prenatal Tips',

  // Spanish
  'Lactancia': 'Lactation',
  'Alimentación del bebé': 'Baby Feeding',
  'Suelo Pélvico': 'Pelvic Floor',
  'Coaching de Sueño': 'Sleep Coaching',
  'Regulación del Sistema Nervioso': 'Nervous System Regulation',
  'Nutrición': 'Nutrition',
  'Odontología Pediátrica': 'Pediatric Dentistry',
  'Coaching de Estilo de Vida': 'Lifestyle Coaching',
  'Regreso al Trabajo': 'Back to Work',
  'Consejos Posparto': 'Postpartum Tips',
  'Consejos Prenatales': 'Prenatal Tips',

  // Vietnamese
  'Cho con bú': 'Lactation',
  'Cho bé bú/ăn': 'Baby Feeding',
  'Sàn Chậu': 'Pelvic Floor',
  'Huấn luyện Giấc ngủ': 'Sleep Coaching',
  'Điều hòa Hệ Thần kinh': 'Nervous System Regulation',
  'Dinh dưỡng': 'Nutrition',
  'Nha khoa Nhi': 'Pediatric Dentistry',
  'Huấn luyện Lối sống': 'Lifestyle Coaching',
  'Thể dục/Yoga': 'Fitness/yoga',
  'Trở lại Làm việc': 'Back to Work',
  'Mẹo Sau sinh': 'Postpartum Tips',
  'Mẹo Trước sinh': 'Prenatal Tips',
};

// Common synonyms collapsed to canonical slugs (for matching expert specialties).
export const CANONICAL_ALIAS_MAP: Record<string, string> = {
  'fitness': 'fitness-yoga',
  'fitness-yoga': 'fitness-yoga',
  'fitness&yoga': 'fitness-yoga',
  // Lactation is its own canonical slug so Lactation-tagged experts
  // match users who picked Lactation.
  'breastfeeding': 'lactation',
  'breast-feeding': 'lactation',
  'lactation': 'lactation',
  'postnatal': 'postpartum-tips',
  'post-natal': 'postpartum-tips',
  'postpartum': 'postpartum-tips',
  'pelvicfloor': 'pelvic-floor',
  'pelvic-floor': 'pelvic-floor',
  'prenatal': 'prenatal-tips',
  'prenatal-tips': 'prenatal-tips',
};

export function canonicalizeSlug(s: string): string {
  const normalized = String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  return CANONICAL_ALIAS_MAP[normalized] || normalized;
}

/**
 * Resolve a raw user-stored topic (could be a canonical English key, a
 * legacy translation, or a slug) to the canonical English key.
 */
export function resolveTopicKey(rawTopic: string): string | null {
  if (!rawTopic) return null;
  if (TOPIC_SLUG_MAP[rawTopic]) return rawTopic;
  if (LEGACY_TOPIC_MAP[rawTopic]) return LEGACY_TOPIC_MAP[rawTopic];
  return null;
}

/**
 * Given a user's `topics_of_interest` (array of strings stored on the
 * profile) and an expert's `expert_specialties` (array of strings),
 * return the count of overlapping topic↔specialty matches after
 * alias normalization.
 */
export function topicSpecialtyOverlap(
  userTopics: string[] | null | undefined,
  expertSpecialties: string[] | null | undefined,
): number {
  if (!userTopics?.length || !expertSpecialties?.length) return 0;

  // Build set of canonical slugs the expert covers.
  const expertSlugs = new Set<string>();
  for (const spec of expertSpecialties) {
    if (!spec) continue;
    expertSlugs.add(canonicalizeSlug(spec));
  }

  let overlaps = 0;
  for (const rawTopic of userTopics) {
    const topicKey = resolveTopicKey(rawTopic);
    if (!topicKey) continue;
    const related = TOPIC_SLUG_MAP[topicKey] ?? [];
    const hit = related.some((slug) => expertSlugs.has(canonicalizeSlug(slug)));
    if (hit) overlaps += 1;
  }
  return overlaps;
}
