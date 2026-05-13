import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  canonicalizeSlug,
  resolveTopicKey,
  TOPIC_SLUG_MAP,
} from '../../supabase/functions/_shared/topicAliases';
import { useBehavioralInterests } from './useBehavioralInterests';
import { getRecommendationWeights } from '@/utils/recommendationWeights';

export interface ExpertForSort {
  id: string;
  expert_specialties?: string[] | null;
  expert_rating?: number | null;
  expert_total_reviews?: number | null;
  expert_verified?: boolean | null;
  [key: string]: any;
}

const PRENATAL_SLUGS = new Set([
  'prenatal-tips', 'prenatal', 'pregnancy', 'expecting', 'labor-prep', 'lactation', 'baby-feeding',
]);
const POSTPARTUM_SLUGS = new Set([
  'postpartum-tips', 'postpartum', 'newborn', 'infant', 'recovery', 'postnatal',
]);

function buildExpertSlugSet(specialties: string[] | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const spec of specialties ?? []) {
    if (!spec) continue;
    out.add(canonicalizeSlug(spec));
  }
  return out;
}

function expertOnboardingScore(
  expertSlugs: Set<string>,
  profile: any,
): number {
  if (!profile) return 0;
  let score = 0;

  for (const rawTopic of profile.topics_of_interest ?? []) {
    const topicKey = resolveTopicKey(rawTopic);
    if (!topicKey) continue;
    const related = TOPIC_SLUG_MAP[topicKey] ?? [];
    if (related.some((slug) => expertSlugs.has(canonicalizeSlug(slug)))) {
      score += 5;
    }
  }

  if (profile.expecting_status === 'yes') {
    for (const slug of expertSlugs) {
      if (PRENATAL_SLUGS.has(slug)) {
        score += 4;
        break;
      }
    }
  }

  if (profile.has_kids) {
    for (const slug of expertSlugs) {
      if (POSTPARTUM_SLUGS.has(slug)) {
        score += 3;
        break;
      }
    }
  }

  for (const style of profile.parenting_styles ?? []) {
    const styleSlug = canonicalizeSlug(style);
    if (expertSlugs.has(styleSlug)) score += 2;
  }
  return score;
}

function expertBehavioralScore(
  expertSlugs: Set<string>,
  behavioralSlugs: Set<string>,
): number {
  if (behavioralSlugs.size === 0) return 0;
  let score = 0;
  for (const slug of expertSlugs) {
    if (behavioralSlugs.has(slug)) score += 5;
  }
  return score;
}

/**
 * Score an expert against the user's onboarding signals + behavioral signals.
 *
 * Scoring blends two scores via day-based weights (see getRecommendationWeights):
 *   onboardingScore: derived from profile.topics_of_interest, expecting/has_kids, parenting_styles
 *   behavioralScore: derived from purchases (see useBehavioralInterests)
 *
 * Tie-breakers (encoded as small fractions): expert_rating, then total_reviews.
 */
export function usePersonalizedExpertSort() {
  const { profile } = useAuth();
  const { slugs: behavioralSlugs } = useBehavioralInterests();
  const weights = getRecommendationWeights(profile?.created_at);

  const sortPersonalized = useCallback(
    <T extends ExpertForSort>(experts: T[]): (T & { _score: number })[] => {
      const scored = experts.map((expert) => {
        const expertSlugs = buildExpertSlugSet(expert.expert_specialties);
        const onboarding = expertOnboardingScore(expertSlugs, profile);
        const behavioral = expertBehavioralScore(expertSlugs, behavioralSlugs);
        const blended =
          onboarding * weights.onboardingWeight + behavioral * weights.behavioralWeight;

        const rating = Math.max(0, Math.min(5, expert.expert_rating ?? 0));
        const reviews = Math.max(0, expert.expert_total_reviews ?? 0);
        const finalScore =
          blended * 1000 + rating * 10 + Math.min(reviews, 999) / 1000;

        return { ...expert, _score: finalScore };
      });

      scored.sort((a, b) => b._score - a._score);
      return scored;
    },
    [profile, behavioralSlugs, weights.onboardingWeight, weights.behavioralWeight],
  );

  return { sortPersonalized };
}
