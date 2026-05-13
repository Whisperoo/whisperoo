/**
 * Canonical 12-item taxonomy shared between:
 *   - Onboarding topic selection (OnboardingTopics.tsx)
 *   - Expert specialty quick-select (AdminExpertForm.tsx)
 *   - Product tag quick-select (AdminProductForm.tsx)
 *   - Recommendation matching (topicAliases.ts uses these as canonical keys)
 *
 * Keep this list in sync with TOPIC_SLUG_MAP keys in
 * supabase/functions/_shared/topicAliases.ts. Adding an item here without
 * adding it to TOPIC_SLUG_MAP will break recommendation matching.
 */
export const CANONICAL_TOPICS = [
  'Lactation',
  'Baby Feeding',
  'Pelvic Floor',
  'Sleep Coaching',
  'Nervous System Regulation',
  'Nutrition',
  'Pediatric Dentistry',
  'Lifestyle Coaching',
  'Fitness/yoga',
  'Back to Work',
  'Postpartum Tips',
  'Prenatal Tips',
] as const;

export type CanonicalTopic = (typeof CANONICAL_TOPICS)[number];

const CANONICAL_SET: Set<string> = new Set(CANONICAL_TOPICS);

export function isCanonicalTopic(value: string): boolean {
  return CANONICAL_SET.has(value);
}

/** True iff the given list contains at least one canonical topic. */
export function hasCanonicalTopic(values: string[] | null | undefined): boolean {
  if (!values || values.length === 0) return false;
  return values.some((v) => CANONICAL_SET.has(v));
}
