import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import OnboardingLayout from '../../components/layouts/OnboardingLayout';
import { Button } from '../../components/ui/button';
import { ArrowRight, Mail, MessageSquare, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { CONSENT_STEP_ENABLED } from '@/config/features';

/**
 * Messaging consent — the last onboarding step before completion.
 *
 * Sprint 2 (QUO-2026-004) workstream 3, "Onboarding consent UI". The quotation
 * is prescriptive and every rule below maps to a line in it:
 *
 *   - Two separate checkboxes, email and SMS. Not combined.
 *   - Both unchecked by default.
 *   - Not bundled into terms acceptance (that happened at signup).
 *   - SMS consent is not a condition of use: Continue works with both unchecked.
 *   - The exact consent wording shown is versioned; we record the version id,
 *     not just a boolean, via fn_record_messaging_consent.
 *
 * Only a CHECKED box is recorded. Leaving a box unchecked writes nothing —
 * "never opted in" and "opted out" are different facts, and the RPC treats
 * opt_in=false as a revocation with a timestamp, which would be wrong here.
 */

interface ConsentVersion {
  id: string;
  channel: 'email' | 'sms';
  locale: string;
  body: string;
}

const OnboardingConsent: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [versions, setVersions] = useState<Record<'email' | 'sms', ConsentVersion | null>>({ email: null, sms: null });
  const [loading, setLoading] = useState(true);
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch the current copy for the user's language, falling back to English.
  // The text is data, not a translation key: legal owns it and versions it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lang = (i18n.language || 'en').slice(0, 2);
      const { data, error } = await supabase
        .from('consent_versions')
        .select('id, channel, locale, body')
        .eq('is_current', true)
        .in('locale', lang === 'en' ? ['en'] : [lang, 'en']);
      if (cancelled) return;
      if (error) {
        console.error('Error loading consent copy:', error);
      }
      const rows = (data as ConsentVersion[]) ?? [];
      const pick = (channel: 'email' | 'sms') =>
        rows.find((r) => r.channel === channel && r.locale === lang) ??
        rows.find((r) => r.channel === channel && r.locale === 'en') ??
        null;
      setVersions({ email: pick('email'), sms: pick('sms') });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [i18n.language]);

  const finish = () => navigate('/onboarding/complete');

  // Flag off (production until legal copy + SendGrid/Twilio land): every entry
  // point still routes here, so forward to completion instead of rendering.
  if (!CONSENT_STEP_ENABLED) return <Navigate to="/onboarding/complete" replace />;

  const handleContinue = async () => {
    setSaving(true);
    try {
      // Record only what was affirmatively checked. Failures are logged and do
      // not block completion: consent is never a condition of using the product,
      // and a lost opt-in is recoverable (they can opt in from settings later);
      // a blocked onboarding is not.
      const writes: Promise<unknown>[] = [];
      if (emailOptIn && versions.email) {
        writes.push(
          supabase.rpc('fn_record_messaging_consent', { p_channel: 'email', p_opt_in: true, p_version: versions.email.id })
            .then(({ error }) => { if (error) console.warn('Email consent not recorded:', error); }),
        );
      }
      if (smsOptIn && versions.sms) {
        writes.push(
          supabase.rpc('fn_record_messaging_consent', { p_channel: 'sms', p_opt_in: true, p_version: versions.sms.id })
            .then(({ error }) => { if (error) console.warn('SMS consent not recorded:', error); }),
        );
      }
      await Promise.all(writes);
    } finally {
      setSaving(false);
      finish();
    }
  };

  const handleBack = () => navigate(-1);

  const ConsentBox: React.FC<{
    channel: 'email' | 'sms';
    checked: boolean;
    onChange: (v: boolean) => void;
    Icon: typeof Mail;
    title: string;
  }> = ({ channel, checked, onChange, Icon, title }) => {
    const v = versions[channel];
    const inputId = `consent-${channel}`;
    return (
      <label
        htmlFor={inputId}
        className={`flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition-colors ${
          checked ? 'border-indigo-300 bg-indigo-50/40' : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
      >
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={!v}
          className="mt-1 h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Icon className="w-4 h-4 text-indigo-600 flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-900">{title}</span>
          </div>
          {v ? (
            <p className="text-xs text-gray-600 leading-relaxed">{v.body}</p>
          ) : (
            <p className="text-xs text-gray-400 italic">{t('onboarding.consent.unavailable')}</p>
          )}
        </div>
      </label>
    );
  };

  return (
    <OnboardingLayout onBack={handleBack} onSkip={finish}>
      <div className="space-y-8">
        <div className="bg-white rounded-3xl shadow-lg p-8 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">{t('onboarding.consent.title')}</h1>
            <p className="text-gray-500 text-sm">{t('onboarding.consent.subtitle')}</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : (
            <div className="space-y-3">
              <ConsentBox channel="email" checked={emailOptIn} onChange={setEmailOptIn} Icon={Mail}
                title={t('onboarding.consent.emailTitle')} />
              <ConsentBox channel="sms" checked={smsOptIn} onChange={setSmsOptIn} Icon={MessageSquare}
                title={t('onboarding.consent.smsTitle')} />
            </div>
          )}

          <p className="text-[11px] text-gray-400 text-center leading-relaxed">
            {t('onboarding.consent.optional')}
          </p>
        </div>

        <Button
          onClick={handleContinue}
          disabled={saving || loading}
          className="w-full h-12 text-base font-semibold rounded-2xl"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            <>
              {t('onboarding.common.continue')}
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      </div>
    </OnboardingLayout>
  );
};

export default OnboardingConsent;
