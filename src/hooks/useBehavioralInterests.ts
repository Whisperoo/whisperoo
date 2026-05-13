import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { canonicalizeSlug } from '../../supabase/functions/_shared/topicAliases';

/**
 * Derive a set of canonical interest slugs from a user's actual behavior.
 *
 * Current signals:
 *   - Purchased products → product.tags + product.categories + linked expert specialties
 *
 * Returns a Set of canonical slugs (already normalised through CANONICAL_ALIAS_MAP).
 * Empty set for guests or users with no qualifying activity — callers should
 * treat that as "no behavioral signal yet" and fall back to onboarding scoring.
 */
export function useBehavioralInterests(): {
  slugs: Set<string>;
  loading: boolean;
} {
  const { user } = useAuth();
  const [slugs, setSlugs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setSlugs(new Set());
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('purchases')
          .select(
            `
              id,
              product:products (
                id,
                tags,
                expert:profiles!products_expert_id_fkey(expert_specialties),
                categories:product_category_mappings(category:product_categories(slug))
              )
            `,
          )
          .eq('user_id', user.id)
          .eq('status', 'completed');

        if (error) throw error;
        if (cancelled) return;

        const next = new Set<string>();
        for (const row of (data ?? []) as any[]) {
          const product = row.product;
          if (!product) continue;

          for (const t of product.tags ?? []) {
            if (t) next.add(canonicalizeSlug(String(t)));
          }
          for (const spec of product.expert?.expert_specialties ?? []) {
            if (spec) next.add(canonicalizeSlug(String(spec)));
          }
          for (const mapping of product.categories ?? []) {
            const slug = mapping?.category?.slug;
            if (slug) next.add(canonicalizeSlug(String(slug)));
          }
        }

        setSlugs(next);
      } catch (err) {
        console.error('useBehavioralInterests: failed to load purchases', err);
        if (!cancelled) setSlugs(new Set());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { slugs, loading };
}
