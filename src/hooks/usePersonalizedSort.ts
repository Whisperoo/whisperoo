import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ProductWithDetails } from '@/services/products';

// Maps each onboarding topic to the product category slugs and tag slugs
// that are most relevant to that topic. Used for client-side relevance scoring.
// Maps each onboarding topic (stable keys) to the product category slugs, tag slugs,
// and expert specialty keywords that are most relevant to that topic.
const TOPIC_SLUG_MAP: Record<string, string[]> = {
  'Baby Feeding':              ['Baby Feeding', 'baby-feeding', 'feeding', 'nutrition', 'breastfeeding', 'formula', 'lactation'],
  'Pelvic Floor':              ['Pelvic Floor', 'pelvic-floor', 'postpartum', 'womens-health', 'recovery', 'pelvic-floor-coaching'],
  'Sleep Coaching':            ['Sleep Coaching', 'sleep-coaching', 'sleep', 'routines', 'nap-transitions', 'bedtime'],
  'Nervous System Regulation': ['Nervous System Regulation', 'nervous-system', 'mental-health', 'self-care', 'wellness', 'anxiety', 'stress-regulation'],
  'Nutrition':                 ['Nutrition', 'nutrition', 'baby-feeding', 'feeding', 'wellness', 'dietitian', 'gut-health'],
  'Pediatric Dentistry':       ['Pediatric Dentistry', 'pediatric-dentistry', 'dental', 'pediatric', 'health', 'oral-health', 'teething'],
  'Lifestyle Coaching':        ['Lifestyle Coaching', 'lifestyle-coaching', 'lifestyle', 'coaching', 'wellness', 'productivity', 'organization'],
  'Fitness/yoga':              ['Fitness/yoga', 'fitness-yoga', 'fitness', 'yoga', 'postpartum', 'exercise', 'prenatal-yoga'],
  'Back to Work':              ['Back to Work', 'back-to-work', 'career', 'lifestyle', 'childcare', 'work-life-balance'],
  'Postpartum Tips':           ['Postpartum Tips', 'postpartum-tips', 'postpartum', 'recovery', 'mental-health', 'newborn-care'],
  'Prenatal Tips':             ['Prenatal Tips', 'prenatal-tips', 'prenatal', 'pregnancy', 'expecting', 'labor-prep', 'birth-plan'],
};

// Legacy mappings for users who onboarded before keys were implemented (translated strings)
const LEGACY_TOPIC_MAP: Record<string, string> = {
  // English
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
  'Alimentación del bebé': 'Baby Feeding',
  'Suelo Pélvico': 'Pelvic Floor',
  'Coaching de Sueño': 'Sleep Coaching',
  'Regulación del Sistema Nervioso': 'Nervous System Regulation',
  'Nutrición': 'Nutrition',
  'Odontología Pediátrica': 'Pediatric Dentistry',
  'Coaching de Estilo de Vida': 'Lifestyle Coaching',
  // 'Fitness/yoga' is the same in Spanish
  'Regreso al Trabajo': 'Back to Work',
  'Consejos Posparto': 'Postpartum Tips',
  'Consejos Prenatales': 'Prenatal Tips',

  // Vietnamese
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

const PRENATAL_SLUGS  = new Set(['prenatal-tips', 'prenatal', 'pregnancy', 'expecting', 'labor-prep']);
const POSTPARTUM_SLUGS = new Set(['postpartum-tips', 'postpartum', 'newborn', 'infant', 'recovery', 'postnatal']);

// Known alias mappings: map common synonyms and non-slug tag forms to canonical tag slugs
const CANONICAL_ALIAS_MAP: Record<string, string> = {
  // Fitness aliases
  'fitness': 'fitness-yoga',
  'fitness-yoga': 'fitness-yoga',
  'fitness&yoga': 'fitness-yoga',

  // Baby feeding aliases
  'breastfeeding': 'baby-feeding',
  'breast-feeding': 'baby-feeding',
  'lactation': 'baby-feeding',

  // Postpartum aliases
  'postnatal': 'postpartum-tips',
  'post-natal': 'postpartum-tips',
  'postpartum': 'postpartum-tips',

  // Pelvic floor
  'pelvicfloor': 'pelvic-floor',
  'pelvic-floor': 'pelvic-floor',

  // Prenatal
  'prenatal': 'prenatal-tips',
  'prenatal-tips': 'prenatal-tips',
};

function canonicalizeSlug(s: string) {
  const normalized = String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  return CANONICAL_ALIAS_MAP[normalized] || normalized;
}

/**
 * Returns a function that re-orders a product list by personalised relevance.
 * Scoring factors (highest first):
 *   +5 for exact tag/slug match
 *   +3 per related topic/category slug
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

      const categorySlugs = (product.categories ?? [])
        .map((c: any) => (c.category?.slug ?? '') as string)
        .filter(Boolean);

      const rawTags: string[] = ((product as any).tags ?? []).filter(Boolean);

      const productTags: string[] = rawTags
        .map((s: string) => canonicalizeSlug(String(s || '')))
        .filter(Boolean as any);
      
      const expertSpecialties: string[] = (product.expert?.expert_specialties ?? [])
        .map((s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '-'));

      const allSlugs = new Set([
        ...rawTags, // Match exact labels too!
        ...categorySlugs.map((s: string) => canonicalizeSlug(String(s).toLowerCase())),
        ...productTags.map((s: string) => canonicalizeSlug(s)),
        ...expertSpecialties.map((s: string) => canonicalizeSlug(s)),
      ]);
      
      // Fallback: If no tags/slugs match, we'll scan the title and description for keywords
      const titleLower = (product.title ?? '').toLowerCase();
      const descLower = (product.description ?? '').toLowerCase();

      // Process user topics (handling both keys and legacy labels)
      (profile.topics_of_interest ?? []).forEach((topic) => {
        // 1. Try exact match with stable keys
        let related = TOPIC_SLUG_MAP[topic];
        
        // 2. Fallback to legacy map if not found
        if (!related && LEGACY_TOPIC_MAP[topic]) {
          related = TOPIC_SLUG_MAP[LEGACY_TOPIC_MAP[topic]];
        }
        
        if (related) {
          let topicMatched = false;
          related.forEach((slug) => {
            // Priority 1: Tag/Slug match
            if (allSlugs.has(slug)) {
              topicMatched = true;
              if (slug === related[0]) score += 5;
              else score += 3;
            }
          });

          // Priority 2: Keyword match in title/description (if no tag match yet)
          if (!topicMatched) {
            const primaryKeyword = related[0].replace(/-/g, ' ');
            if (titleLower.includes(primaryKeyword) || descLower.includes(primaryKeyword)) {
              score += 2; // Lower weight for keyword matches vs explicit tags
            }
          }
        }
      });

      // +2 per parenting style tag match
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

      // Small tie-breaker to prefer newest if scores are equal
      return score * 1000 - index;
    }

    return [...products].sort(
      (a, b) =>
        scoreProduct(b, products.indexOf(b)) - scoreProduct(a, products.indexOf(a)),
    );
  }, [profile]);

  return { sortPersonalized };
}
