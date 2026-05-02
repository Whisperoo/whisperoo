import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

const LANGUAGES = [
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'es', flag: '🇲🇽', label: 'Español' },
  { code: 'vi', flag: '🇻🇳', label: 'Tiếng Việt' },
];

/**
 * LanguageSwitcher — renders in the Settings page.
 * Switches the active i18next language and persists the preference
 * to the user's Supabase profile row.
 */
interface LanguageSwitcherProps {
  compact?: boolean;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ compact = false }) => {
  const { i18n, t } = useTranslation();
  const { profile, user, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  // Sync language from profile on mount
  useEffect(() => {
    const stored = (profile as Record<string, unknown>)?.language_preference as string | undefined;
    if (stored && stored !== i18n.language) {
      i18n.changeLanguage(stored);
    }
  }, [profile]);

  const handleChange = async (langCode: string) => {
    if (langCode === i18n.language || saving) return;

    i18n.changeLanguage(langCode);

    if (!user) return;
    setSaving(true);
    try {
      const { error } = await updateProfile({ language_preference: langCode } as any);
      if (error) throw error;

      toast({
        title: t('settings.language.savedToast'),
        description: t('settings.language.savedToastDescription'),
      });
    } catch (err) {
      console.error('Failed to save language preference:', err);
    } finally {
      setSaving(false);
    }
  };

  // ── Compact mode: small flag+code dropdown for tight spaces (e.g. onboarding header)
  if (compact) {
    return (
      <div className="relative flex items-center">
        <Globe className="w-3.5 h-3.5 text-gray-400 absolute left-2 pointer-events-none" />
        <select
          value={i18n.language}
          onChange={(e) => handleChange(e.target.value)}
          disabled={saving}
          className="pl-7 pr-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg appearance-none cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-60"
          aria-label="Select language"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.code.toUpperCase()}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // ── Full mode: used on Profile/Settings page
  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {t('settings.language.sectionTitle')}
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        {t('settings.language.sectionDescription')}
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        {LANGUAGES.map((lang) => {
          const isActive = i18n.language === lang.code;
          return (
            <button
              key={lang.code}
              id={`lang-switcher-${lang.code}`}
              onClick={() => handleChange(lang.code)}
              disabled={saving}
              aria-pressed={isActive}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all duration-200 w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-brand-primary/50 ${
                isActive
                  ? 'border-brand-primary bg-brand-primary/5 text-brand-primary shadow-sm'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-brand-primary/40 hover:bg-brand-primary/5'
              } ${saving ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className="text-xl leading-none">{lang.flag}</span>
              <span>{lang.label}</span>
              {isActive && (
                <span className="ml-auto w-2 h-2 rounded-full bg-brand-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LanguageSwitcher;
