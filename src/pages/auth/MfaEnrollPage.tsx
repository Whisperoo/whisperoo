import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { STAFF_ACCOUNT_TYPES } from '@/hooks/useMfaStatus';
import { Shield, CheckCircle, AlertCircle, Loader2, Copy } from 'lucide-react';

/**
 * MfaEnrollPage — HIPAA B6
 *
 * Staff (super_admin / superadmin): TOTP enrollment is required; this page
 * starts enrollment once the profile is loaded.
 *
 * Parents: optional enrollment when opened with ?optional=true (e.g. from Profile).
 *
 * Route: /auth/mfa-enroll
 */

type Step = 'init' | 'optional_intro' | 'qr' | 'verify' | 'success' | 'error';

const MfaEnrollPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, user, loading: authLoading } = useAuth();

  const optionalFlow = searchParams.get('optional') === 'true';
  const returnToParam = searchParams.get('returnTo');

  const [step, setStep] = useState<Step>('init');
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [totp, setTotp] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const isStaff = (STAFF_ACCOUNT_TYPES as readonly string[]).includes(profile?.account_type ?? '');

  const resolveReturnPath = () => {
    if (returnToParam && returnToParam.startsWith('/')) return returnToParam;
    if (isStaff) return '/admin/super';
    return '/profile';
  };

  const enroll = useCallback(async () => {
    setStep('init');
    setError('');
    try {
      const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Whisperoo (${profile?.first_name ?? 'Account'})`,
      });

      if (enrollErr || !data) {
        throw enrollErr ?? new Error('Enrollment failed');
      }

      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setStep('qr');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to start enrollment. Please try again.';
      setError(msg);
      setStep('error');
    }
  }, [profile?.first_name]);

  const enrollRef = useRef(enroll);
  enrollRef.current = enroll;

  // Auth + role gates, then staff auto-start or optional intro
  useEffect(() => {
    let cancelled = false;

    if (authLoading) {
      return () => {
        cancelled = true;
      };
    }
    if (!user) {
      navigate('/auth/login', { replace: true });
      return () => {
        cancelled = true;
      };
    }
    if (!profile) {
      return () => {
        cancelled = true;
      };
    }

    if (!isStaff && !optionalFlow) {
      navigate('/dashboard', { replace: true });
      return () => {
        cancelled = true;
      };
    }

    if (!isStaff && optionalFlow) {
      setStep('optional_intro');
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const { data: factorsData, error: fErr } = await supabase.auth.mfa.listFactors();
        if (cancelled) return;
        if (fErr) throw fErr;
        const verifiedFactor = factorsData?.totp?.find((f) => f.status === 'verified');
        if (verifiedFactor) {
          const { data: aalData, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          if (cancelled) return;
          if (aalErr) throw aalErr;
          if (aalData?.currentLevel === 'aal2') {
            navigate(resolveReturnPath(), { replace: true });
            return;
          }
          const ret = encodeURIComponent(returnToParam ?? (isStaff ? '/admin/super' : '/profile'));
          navigate(`/auth/mfa-challenge?returnTo=${ret}`, { replace: true });
          return;
        }
      } catch {
        // Fall through to enrollment
      }

      if (cancelled) return;
      await enrollRef.current();
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, profile, isStaff, optionalFlow, navigate, returnToParam]);

  const verify = async () => {
    if (totp.replace(/\s/g, '').length !== 6) return;
    setError('');
    try {
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeErr || !challengeData) throw challengeErr;

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: totp.replace(/\s/g, ''),
      });

      if (verifyErr) {
        setError('Code incorrect or expired. Try the next code from your app.');
        return;
      }

      setStep('success');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Verification failed.');
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDone = () => {
    navigate(resolveReturnPath(), { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Two-Factor Authentication</h1>
              <p className="text-blue-100 text-sm">
                {optionalFlow && !isStaff ? 'Optional extra security' : 'Required for super-admin accounts'}
              </p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6">
          {step === 'optional_intro' && (
            <div className="space-y-4 text-center py-4">
              <p className="text-sm text-gray-600">
                Add an authenticator app as a second step when you sign in. Recommended if you use Whisperoo on a shared device.
              </p>
              <button
                type="button"
                onClick={() => {
                  void enroll();
                }}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Set up authenticator
              </button>
              <button
                type="button"
                onClick={() => navigate('/profile', { replace: true })}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Not now
              </button>
            </div>
          )}

          {step === 'init' && (
            <div className="flex flex-col items-center py-10 gap-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-gray-500 text-sm">Setting up authenticator…</p>
            </div>
          )}

          {step === 'qr' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Step 1 — Scan this QR code</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Open your authenticator app (Google Authenticator, Authy, 1Password, etc.) and scan the code below.
                </p>
              </div>

              <div className="flex justify-center">
                <div className="border-2 border-gray-200 rounded-xl p-3 bg-white">
                  <img src={qrCode} alt="TOTP QR code" className="w-44 h-44" />
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-xs font-semibold text-gray-600 mb-2">Can&apos;t scan? Enter this key manually:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono text-gray-800 bg-white border border-gray-200 rounded-lg px-3 py-2 break-all">
                    {secret}
                  </code>
                  <button
                    type="button"
                    onClick={copySecret}
                    className="flex-shrink-0 p-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                    title="Copy secret"
                  >
                    {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setTotp('');
                  setStep('verify');
                }}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                I&apos;ve scanned it — Continue
              </button>
            </div>
          )}

          {step === 'verify' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Step 2 — Enter the 6-digit code</h2>
                <p className="text-sm text-gray-500 mt-1">Open your authenticator app and enter the code shown for Whisperoo.</p>
              </div>

              <input
                type="text"
                inputMode="numeric"
                maxLength={7}
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/[^0-9 ]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && void verify()}
                placeholder="000 000"
                className="w-full text-center text-3xl font-mono tracking-widest border-2 border-gray-200 rounded-xl px-4 py-4 focus:outline-none focus:border-blue-500 transition-colors"
              />

              {error && (
                <div className="flex items-start gap-2 text-red-600 bg-red-50 rounded-xl px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('qr')}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void verify()}
                  disabled={totp.replace(/\s/g, '').length !== 6}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Verify & Activate
                </button>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center py-6 gap-4 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">MFA Activated</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Two-factor authentication is now enabled. You may be asked for a code when you sign in.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDone}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center py-6 gap-4 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Setup Failed</h2>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => void enroll()}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {(isStaff || step === 'optional_intro') && (
            <p className="text-[11px] text-gray-400 text-center mt-4 leading-relaxed">
              {isStaff
                ? 'Super-admin accounts must use two-factor authentication under HIPAA access-control expectations (45 CFR 164.312).'
                : 'Two-factor authentication is optional for your account; super-admin accounts are required to use it.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MfaEnrollPage;
