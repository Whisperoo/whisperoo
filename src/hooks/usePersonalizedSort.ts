import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ProductWithDetails } from '@/services/products';

// Maps each onboarding topic to the product category slugs and tag slugs
// that are most relevant to that topic. Used for client-side relevance scoring.
const TOPIC_SLUG_MAP: Record<string, string[]> = {
  'Baby Feeding':              ['baby-feeding', 'feeding', 'nutrition', 'breastfeeding'],
  'Pelvic Floor':              ['pelvic-floor', 'postpartum', 'womens-health', 'recovery'],
  'Sleep Coaching':            ['sleep-coaching', 'sleep', 'routines'],
  'Nervous System Regulation': ['nervous-system', 'mental-health', 'self-care', 'wellness'],
  'Nutrition':                 ['nutrition', 'baby-feeding', 'feeding', 'wellness'],
  'Pediatric Dentistry':       ['pediatric-dentistry', 'dental', 'pediatric', 'health'],
  'Lifestyle Coaching':        ['lifestyle-coaching', 'lifestyle', 'coaching', 'wellness'],
  'Fitness/yoga':              ['fitness-yoga', 'fitness', 'yoga', 'postpartum'],
  'Back to Work':              ['back-to-work', 'career', 'lifestyle'],
  'Postpartum Tips':           ['postpartum-tips', 'postpartum', 'recovery', 'mental-health'],
  'Prenatal Tips':             ['prenatal-tips', 'prenatal', 'pregnancy', 'expecting'],
};

const PRENATAL_SLUGS  = new Set(['prenatal-tips', 'prenatal', 'pregnancy', 'expecting']);
const POSTPARTUM_SLUGS = new Set(['postpartum-tips', 'postpartum', 'newborn', 'infant', 'recovery']);

/**
 * Returns a function that re-orders a product list by personalised relevance.
 * Scoring factors (highest first):
 *   +3 per matched topic/category slug
 *   +2 per matched parenting style tag
 *   +4 boost for prenatal content when user is expecting
 *   +3 boost for postpartum content when user has kids
 * Ties broken by original fetch order (newest first).
 */
export function usePersonalizedSort() {
  const { profile } = useAuth();

  const sortPersonalized = useCallback((products: ProductWithDetails[]): ProductWithDetails[] => {
    function scoreProduct(product: ProductWithDetails, index: number): number {
      if (!profile) return -index; // preserve fetch order for guests

      let score = 0;

      // Collect all matchable slugs from this product
      const categorySlugs = (product.categories ?? [])
        .map((c: any) => (c.category?.slug ?? '') as string)
        .filter(Boolean);

      const productTags: string[] = ((product as any).tags ?? []);
      const allSlugs = new Set([...categorySlugs, ...productTags]);

      // +3 per slug that matches a topic the user selected
      (profile.topics_of_interest ?? []).forEach((topic) => {
        const related = TOPIC_SLUG_MAP[topic] ?? [];
        related.forEach((slug) => {
          if (allSlugs.has(slug)) score += 3;
        });
      });

      // +2 per parenting style tag match (style stored as display string, lowercase for comparison)
      (profile.parenting_styles ?? []).forEach((style) => {
        const styleSlug = style.toLowerCase().replace(/\s+/g, '-');
        if (allSlugs.has(styleSlug)) score += 2;
      });

      // Prenatal boost: +4 for expecting users
      if (profile.expecting_status === 'yes') {
        if ([...allSlugs].some((s) => PRENATAL_SLUGS.has(s))) score += 4;
      }

      // Postpartum boost: +3 for users with existing children
      if (profile.has_kids) {
        if ([...allSlugs].some((s) => POSTPARTUM_SLUGS.has(s))) score += 3;
      }

      return score;
    }

    return [...products].sort(
      (a, b) =>
        scoreProduct(b, products.indexOf(b)) - scoreProduct(a, products.indexOf(a)),
    );
  }, [profile]);

  return { sortPersonalized };
}
