/**
 * useMfaStatus.ts
 *
 * Returns the current user's MFA enrollment + assurance state.
 * Used by ProtectedRoute to gate staff-only routes.
 *
 * HIPAA B6: MFA is REQUIRED for super-admin accounts only.
 * Factor type: TOTP (authenticator app — Google Authenticator, Authy, 1Password, etc.)
 *
 * Staff must never bypass the gate when the MFA API fails — we fail closed
 * (see `mfa_check_failed`).
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type MfaStatus =
  | 'loading'
  | 'not_required'
  | 'not_enrolled'
  | 'enrolled_unverified'
  | 'verified'
  /** MFA APIs failed — staff routes must not allow access until recheck succeeds */
  | 'mfa_check_failed';

/**
 * Account types that must use MFA for protected staff routes (HIPAA B6).
 *
 * Scope decision (2026-05-12): super-admin only. Admins and experts retain
 * password-only access. If the hospital procurement questionnaire requires
 * MFA for all PHI-handling staff, broaden this array — the rest of the flow
 * handles any role transparently.
 */
export const STAFF_ACCOUNT_TYPES = ['super_admin', 'superadmin'] as const;

export function useMfaStatus(): { mfaStatus: MfaStatus; recheckMfa: () => void } {
  const { profile, user } = useAuth();
  const [status, setStatus] = useState<MfaStatus>('loading');
  const [tick, setTick] = useState(0);

  const recheckMfa = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!user || !profile) {
      setStatus('loading');
      return;
    }

    const isStaff = (STAFF_ACCOUNT_TYPES as readonly string[]).includes(profile.account_type ?? '');
    if (!isStaff) {
      setStatus('not_required');
      return;
    }

    let cancelled = false;

    (async () => {
      setStatus('loading');
      try {
        const [factorsRes, aalRes] = await Promise.all([
          supabase.auth.mfa.listFactors(),
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        ]);

        if (cancelled) return;

        if (factorsRes.error) throw factorsRes.error;
        if (aalRes.error) throw aalRes.error;

        const totpFactors = factorsRes.data?.totp ?? [];
        const verified = totpFactors.some((f) => f.status === 'verified');

        if (!verified) {
          setStatus('not_enrolled');
          return;
        }

        const aal = aalRes.data?.currentLevel;
        setStatus(aal === 'aal2' ? 'verified' : 'enrolled_unverified');
      } catch (e) {
        console.error('[useMfaStatus] MFA state check failed:', e);
        if (!cancelled) setStatus('mfa_check_failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, profile, tick]);

  return { mfaStatus: status, recheckMfa };
}
