import { useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ProductWithDetails } from '@/services/products';
import {
  TOPIC_SLUG_MAP,
  LEGACY_TOPIC_MAP,
  canonicalizeSlug,
} from '../../supabase/functions/_shared/topicAliases';
import { useBehavioralInterests } from './useBehavioralInterests';
import { getRecommendationWeights } from '@/utils/recommendationWeights';

const PRENATAL_SLUGS  = new Set(['prenatal-tips', 'prenatal', 'pregnancy', 'expecting', 'labor-prep']);
const POSTPARTUM_SLUGS = new Set(['postpartum-tips', 'postpartum', 'newborn', 'infant', 'recovery', 'postnatal']);

function buildProductSlugSet(product: ProductWithDetails): {
  slugs: Set<string>;
  titleLower: string;
  descLower: string;
} {
  const categorySlugs = (product.categories ?? [])
    .map((c: any) => (c.category?.slug ?? '') as string)
    .filter(Boolean);

  const rawTags: string[] = ((product as any).tags ?? []).filter(Boolean);

  const productTags: string[] = rawTags
    .map((s: string) => canonicalizeSlug(String(s || '')))
    .filter(Boolean as any);

  const expertSpecialties: string[] = (product.expert?.expert_specialties ?? [])
    .map((s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '-'));

  const slugs = new Set([
    ...rawTags.map(t => String(t).toLowerCase()),
    ...categorySlugs.map((s: string) => canonicalizeSlug(String(s).toLowerCase()).toLowerCase()),
    ...productTags.map((s: string) => s.toLowerCase()),
    ...expertSpecialties.map((s: string) => s.toLowerCase()),
  ]);

  return {
    slugs,
    titleLower: (product.title ?? '').toLowerCase(),
    descLower: (product.description ?? '').toLowerCase(),
  };
}

function productOnboardingScore(
  product: ProductWithDetails,
  allSlugs: Set<string>,
  titleLower: string,
  descLower: string,
  profile: any,
): number {
  if (!profile) return 0;
  let score = 0;

  (profile.topics_of_interest ?? []).forEach((topic: string) => {
    let related = TOPIC_SLUG_MAP[topic];
    if (!related && LEGACY_TOPIC_MAP[topic]) {
      related = TOPIC_SLUG_MAP[LEGACY_TOPIC_MAP[topic]];
    }
    if (!related) return;

    let topicMatched = false;
    related.forEach((slug) => {
      const normSlug = slug.toLowerCase();
      if (allSlugs.has(normSlug)) {
        topicMatched = true;
        if (normSlug === related[0].toLowerCase()) score += 5;
        else score += 3;
      }
    });

    if (!topicMatched) {
      const primaryKeyword = related[0].replace(/-/g, ' ');
      if (titleLower.includes(primaryKeyword) || descLower.includes(primaryKeyword)) {
        score += 2;
      }
    }
  });

  (profile.parenting_styles ?? []).forEach((style: string) => {
    const styleSlug = style.toLowerCase().replace(/\s+/g, '-');
    if (allSlugs.has(styleSlug)) score += 2;
  });

  if (profile.expecting_status === 'yes') {
    if ([...allSlugs].some((s) => PRENATAL_SLUGS.has(s))) score += 4;
  }
  if (profile.has_kids) {
    if ([...allSlugs].some((s) => POSTPARTUM_SLUGS.has(s))) score += 3;
  }
  return score;
}

function productBehavioralScore(
  allSlugs: Set<string>,
  behavioralSlugs: Set<string>,
): number {
  if (behavioralSlugs.size === 0) return 0;
  let score = 0;
  for (const slug of allSlugs) {
    if (behavioralSlugs.has(slug)) score += 3;
  }
  return score;
}

/**
 * Returns a function that re-orders a product list by personalised relevance.
 *
 * Score = onboardingScore * onboardingWeight + behavioralScore * behavioralWeight
 * Weights ramp from {1.0, 0.0} on day 0 to {0.3, 0.7} on day 30+ (see
 * getRecommendationWeights).
 *
 * Onboarding factors:
 *   +5 exact topic primary-slug match, +3 related-slug match, +2 keyword fallback
 *   +2 per matched parenting style tag
 *   +4 prenatal boost for expecting users
 *   +3 postpartum boost for users with kids
 *
 * Behavioral factor:
 *   +3 per product slug that matches a slug derived from the user's purchase history
 */
export function usePersonalizedSort() {
  const { profile } = useAuth();
  const { slugs: behavioralSlugs } = useBehavioralInterests();

  // Memoized weight primitives — only recompute when profile.created_at changes (once after login).
  // This prevents getRecommendationWeights() from returning a new object every render.
  const { onboardingWeight, behavioralWeight } = useMemo(
    () => getRecommendationWeights(profile?.created_at),
    [profile?.created_at],
  );

  // Refs give the callback access to latest values without making it unstable.
  // sortPersonalized only needs to be recreated when the day-based weights shift
  // (i.e., after ~30 days), not on every profile or behavioral state change.
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const behavioralRef = useRef(behavioralSlugs);
  behavioralRef.current = behavioralSlugs;

  const sortPersonalized = useCallback(
    (products: ProductWithDetails[]): ProductWithDetails[] => {
      const p = profileRef.current;
      const b = behavioralRef.current;
      const scoreMap = new Map<string, number>();

      products.forEach((product, index) => {
        const { slugs, titleLower, descLower } = buildProductSlugSet(product);
        const onboarding = productOnboardingScore(product, slugs, titleLower, descLower, p);
        const behavioral = productBehavioralScore(slugs, b);
        const blended = onboarding * onboardingWeight + behavioral * behavioralWeight;
        // Scale so personalized order dominates; -index keeps newest as tiebreaker.
        const finalScore = blended * 1000 - index;
        scoreMap.set(product.id, finalScore);
      });

      return [...products].sort((a, b) => {
        const scoreA = scoreMap.get(a.id) ?? 0;
        const scoreB = scoreMap.get(b.id) ?? 0;
        return scoreB - scoreA;
      });
    },
    [onboardingWeight, behavioralWeight], // stable: only changes on the day-0→day-30 weight ramp
  );

  return { sortPersonalized };
}
