/**
 * translationService.ts
 *
 * Wraps the Google Cloud Translation API — Neural Machine Translation (NMT).
 *
 * Architecture: Translate-on-Write
 *   This service is called ONCE when an expert saves their profile.
 *   Translated bios are persisted directly into the database columns
 *   (expert_bio_es, expert_bio_vi), so end users load pre-translated text
 *   with zero latency and zero repeated API cost.
 *
 * Pricing (as of May 2026):
 *   - First 500,000 characters/month → FREE
 *   - 500k–1B characters/month       → $20 per million characters
 *
 * Activation:
 *   Do NOT call Google Translate directly from the browser.
 *   Translation is performed server-side via `supabase/functions/auto-translate`
 *   (triggered by DB or invoked explicitly) and persisted to translated columns.
 */

const TARGET_LANGUAGES = ['es', 'vi'] as const;

export interface TranslationResult {
  es: string;
  vi: string;
}

/**
 * Translates a plain-text string into all supported app languages
 * (Spanish and Vietnamese) simultaneously using Google NMT.
 *
 * Falls back gracefully to the original text if:
 *  - The API key is not configured
 *  - The API call fails for any reason
 *
 * @param text       The source text to translate (English)
 * @param sourceLang ISO 639-1 source language code (default: 'en')
 */
export async function translateToAllLanguages(
  text: string,
  sourceLang = 'en'
): Promise<TranslationResult> {
  // Client-side translation is intentionally disabled (security).
  // The server persists translations via Edge Function + DB triggers.
  void TARGET_LANGUAGES;
  void sourceLang;
  return { es: text, vi: text };
}

/**
 * Convenience helper: returns the correct bio string for the current
 * i18n language, falling back to English if translation is not yet available.
 *
 * Usage in components:
 *   import { getLocalizedBio } from '@/services/translationService';
 *   <p>{getLocalizedBio(expert, i18n.language)}</p>
 */
export function getLocalizedBio(
  expert: {
    expert_bio?: string | null;
    expert_bio_es?: string | null;
    expert_bio_vi?: string | null;
  },
  language: string
): string {
  if (language === 'es' && expert.expert_bio_es) return expert.expert_bio_es;
  if (language === 'vi' && expert.expert_bio_vi) return expert.expert_bio_vi;
  return expert.expert_bio ?? '';
}
