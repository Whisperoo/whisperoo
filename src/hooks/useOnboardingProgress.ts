import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

/**
 * Canonical onboarding route order. `hospital-check` is conditional —
 * shown only when (a) the user has no tenant_id yet AND (b) at least one
 * `tenants` row has `is_active = true`. Otherwise the flow skips it.
 */
const BASE_ROUTES = [
  '/onboarding/role',
  '/onboarding/kids',
  '/onboarding/kids-count',
  '/onboarding/topics',
  '/onboarding/personal-context',
] as const;

const HOSPITAL_ROUTE = '/onboarding/hospital-check';

/**
 * useOnboardingProgress
 *
 * Returns `{ step, total }` for the current onboarding route, accounting for
 * whether the hospital-check step is part of the flow for this user.
 *
 * The hook reads `useLocation()` so it stays in sync as the user navigates.
 */
export function useOnboardingProgress(): { step: number; total: number } {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const [hasActiveTenants, setHasActiveTenants] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Skip the dashboard query if we already know the user is linked to a tenant —
      // they're either past the hospital-check (linked via QR) or just don't need it.
      if (profile?.tenant_id) {
        if (!cancelled) setHasActiveTenants(false);
        return;
      }
      const { count, error } = await supabase
        .from('tenants')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);
      if (!cancelled) {
        setHasActiveTenants(error ? false : (count ?? 0) > 0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.tenant_id]);

  // While we're still resolving tenant state, fall back to B2C totals so the
  // pager dots don't flicker. The number stabilises on the first render after
  // the tenant query resolves.
  const includeHospital = hasActiveTenants === true && !profile?.tenant_id;

  const flow = includeHospital
    ? [BASE_ROUTES[0], HOSPITAL_ROUTE, ...BASE_ROUTES.slice(1)]
    : [...BASE_ROUTES];

  const total = flow.length;
  const idx = flow.findIndex((r) => pathname.startsWith(r));
  const step = idx >= 0 ? idx + 1 : 1;

  return { step, total };
}