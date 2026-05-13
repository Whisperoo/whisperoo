import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { STAFF_ACCOUNT_TYPES } from '@/hooks/useMfaStatus';
import { Shield, AlertCircle, Loader2 } from 'lucide-react';

/**
 * MfaChallengePage
 *
 * HIPAA B6: Shown after login when a super-admin user has a verified TOTP factor
 * but the current session is still at AAL1. They must enter their authenticator
 * code to elevate to AAL2 before accessing admin routes.
 *
 * Route: /auth/mfa-challenge
 */

const MfaChallengePage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, user, loading: authLoading } = useAuth();
  const [totp, setTotp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth/login', { replace: true });
      return;
    }
    if (!profile) return;
    const isStaff = (STAFF_ACCOUNT_TYPES as readonly string[]).includes(profile.account_type ?? '');
    if (!isStaff) {
      navigate('/dashboard', { replace: true });
    }
  }, [authLoading, user, profile, navigate]);

  const verify = async () => {
    const code = totp.replace(/\s/g, '');
    if (code.length !== 6) return;

    setLoading(true);
    setError('');

    try {
      // Get the verified TOTP factor
      const { data: factorsData, error: factorsErr } = await supabase.auth.mfa.listFactors();
      if (factorsErr) throw factorsErr;

      const factor = factorsData?.totp?.find((f) => f.status === 'verified');
      if (!factor) {
        // No verified factor — send to enrollment
        navigate('/auth/mfa-enroll', { replace: true });
        return;
      }

      // Issue a challenge
      const { data: challengeData, error: challengeErr } =
        await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challengeErr || !challengeData) throw challengeErr;

      // Verify the code → elevates session to AAL2
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challengeData.id,
        code,
      });

      if (verifyErr) {
        setError('Incorrect code. Check your authenticator app and try again.');
        setTotp('');
        return;
      }

      // AAL2 achieved — redirect to intended destination
      const returnTo = new URLSearchParams(window.location.search).get('returnTo');
      navigate(returnTo ?? '/admin/super', { replace: true });
    } catch (e: any) {
      setError(e?.message ?? 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Verification Required</h1>
              <p className="text-blue-100 text-sm">Enter your authenticator code</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-5">
          <p className="text-sm text-gray-600 leading-relaxed">
            Open your authenticator app and enter the 6-digit code for <strong>Whisperoo</strong>.
          </p>

          <input
            type="text"
            inputMode="numeric"
            maxLength={7}
            value={totp}
            onChange={(e) => setTotp(e.target.value.replace(/[^0-9 ]/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && verify()}
            placeholder="000 000"
            autoFocus
            disabled={loading}
            className="w-full text-center text-3xl font-mono tracking-widest border-2 border-gray-200 rounded-xl px-4 py-4 focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-colors"
          />

          {error && (
            <div className="flex items-start gap-2 text-red-600 bg-red-50 rounded-xl px-4 py-3 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={verify}
            disabled={loading || totp.replace(/\s/g, '').length !== 6}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Verifying…' : 'Verify & Continue'}
          </button>

          <div className="border-t border-gray-100 pt-4">
            <button
              onClick={handleSignOut}
              className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Sign out and use a different account
            </button>
          </div>

          <p className="text-[11px] text-gray-400 text-center leading-relaxed">
            Two-factor authentication is required for super-admin accounts under HIPAA access-control expectations (45 CFR 164.312).
          </p>
        </div>
      </div>
    </div>
  );
};

export default MfaChallengePage;
