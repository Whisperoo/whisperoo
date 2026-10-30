import React, { useEffect, useState } from 'react';
import { Mail, MessageSquare, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

/**
 * Email/SMS opt-in — shared by the onboarding consent step and the one-time
 * login prompt for parents who signed up before the step existed.
 *
 * Sprint 2 (QUO-2026-004) workstream 3. Every rule maps to a line in the quote:
 *   - Two separate checkboxes, email and SMS. Not combined.
 *   - Both unchecked by default.
 *   - Not bundled into terms acceptance (that happened at signup).
 *   - SMS consent is not a condition of use: the parent can continue with both unchecked.
 *   - The exact wording shown is versioned; we record the version id, not just a
 *     boolean, via fn_record_messaging_consent.
 *
 * Only a CHECKED box is recorded. Leaving a box unchecked writes nothing —
 * "never opted in" and "opted out" are different facts, and the RPC treats
 * opt_in=false as a revocation with a timestamp, which would be wrong here.
 */

export interface ConsentVersion {
  id: string;
  channel: 'email' | 'sms';
  locale: string;
  body: string;
}

/**
 * Consent copy is stored verbatim (legal's text) and may reference the Terms and
 * Privacy Policy as markdown-style links: [Terms](https://whisperoo.app/...). Render
 * those as real links; everything else stays plain text (no HTML from the database).
 * Only https links on whisperoo.app are honoured — anything else renders as text.
 * A link inside the <label> doesn't toggle the checkbox: the label's activation
 * behaviour skips interactive descendants.
 */
const CONSENT_LINK = /\[([^\]]+)\]\((https:\/\/(?:www\.)?whisperoo\.app\/[^\s)]*)\)/g;

function renderConsentBody(body: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of body.matchAll(CONSENT_LINK)) {
    const at = m.index ?? 0;
    if (at > last) out.push(body.slice(last, at));
    out.push(
      <a
        key={at}
        href={m[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 text-indigo-600 hover:text-indigo-700"
      >
        {m[1]}
      </a>,
    );
    last = at + m[0].length;
  }
  if (last < body.length) out.push(body.slice(last));
  return out;
}

export interface ConsentForm {
  versions: Record<'email' | 'sms', ConsentVersion | null>;
  loading: boolean;
  emailOptIn: boolean;
  setEmailOptIn: (v: boolean) => void;
  smsOptIn: boolean;
  setSmsOptIn: (v: boolean) => void;
  /** Records what was checked, and marks the parent as asked. Never throws. */
  save: () => Promise<void>;
  /** Marks the parent as asked without recording any opt-in ("Not now" / skip). */
  dismiss: () => Promise<void>;
}

async function markPrompted(): Promise<void> {
  const { error } = await supabase.rpc('fn_mark_consent_prompted');
  if (error) console.warn('Consent prompt not marked as shown:', error);
}

export function useConsentForm(): ConsentForm {
  const { i18n } = useTranslation();
  const [versions, setVersions] = useState<ConsentForm['versions']>({ email: null, sms: null });
  const [loading, setLoading] = useState(true);
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [smsOptIn, setSmsOptIn] = useState(false);

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

  const save = async () => {
    // Failures are logged and never block the parent: consent is not a condition of
    // using the product. A lost opt-in can be re-asked; a blocked app cannot.
    const writes: Promise<unknown>[] = [];
    if (emailOptIn && versions.email) {
      writes.push(Promise.resolve(
        supabase.rpc('fn_record_messaging_consent', { p_channel: 'email', p_opt_in: true, p_version: versions.email.id })
          .then(({ error }) => { if (error) console.warn('Email consent not recorded:', error); }),
      ));
    }
    if (smsOptIn && versions.sms) {
      writes.push(Promise.resolve(
        supabase.rpc('fn_record_messaging_consent', { p_channel: 'sms', p_opt_in: true, p_version: versions.sms.id })
          .then(({ error }) => { if (error) console.warn('SMS consent not recorded:', error); }),
      ));
    }
    writes.push(markPrompted());
    await Promise.all(writes);
  };

  return { versions, loading, emailOptIn, setEmailOptIn, smsOptIn, setSmsOptIn, save, dismiss: markPrompted };
}

const ConsentBox: React.FC<{
  channel: 'email' | 'sms';
  version: ConsentVersion | null;
  checked: boolean;
  onChange: (v: boolean) => void;
  Icon: typeof Mail;
  title: string;
}> = ({ channel, version, checked, onChange, Icon, title }) => {
  const { t } = useTranslation();
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
        disabled={!version}
        className="mt-1 h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-900">{title}</span>
        </div>
        {version ? (
          <p className="text-xs text-gray-600 leading-relaxed">{renderConsentBody(version.body)}</p>
        ) : (
          <p className="text-xs text-gray-400 italic">{t('onboarding.consent.unavailable')}</p>
        )}
      </div>
    </label>
  );
};

/** The two checkboxes plus the "both optional / reply STOP" line. */
export const ConsentChoices: React.FC<{ form: ConsentForm }> = ({ form }) => {
  const { t } = useTranslation();
  return (
    <>
      {form.loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="space-y-3">
          <ConsentBox channel="email" version={form.versions.email} checked={form.emailOptIn}
            onChange={form.setEmailOptIn} Icon={Mail} title={t('onboarding.consent.emailTitle')} />
          <ConsentBox channel="sms" version={form.versions.sms} checked={form.smsOptIn}
            onChange={form.setSmsOptIn} Icon={MessageSquare} title={t('onboarding.consent.smsTitle')} />
        </div>
      )}
      <p className="text-[11px] text-gray-400 text-center leading-relaxed">
        {t('onboarding.consent.optional')}
      </p>
    </>
  );
};
