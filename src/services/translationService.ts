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
 *   Add VITE_GOOGLE_TRANSLATE_API_KEY to your .env file.
 *   Until then, the service runs in passthrough mode (returns original text).
 */

const GOOGLE_TRANSLATE_API_KEY = import.meta.env.VITE_GOOGLE_TRANSLATE_API_KEY as string | undefined;
const GOOGLE_TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2';

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
  // ── Passthrough mode (API key not configured yet) ──────────────────────────
  if (!GOOGLE_TRANSLATE_API_KEY || GOOGLE_TRANSLATE_API_KEY === 'PLACEHOLDER') {
    console.info(
      '[translationService] Running in passthrough mode — set VITE_GOOGLE_TRANSLATE_API_KEY to activate.'
    );
    return { es: text, vi: text };
  }

  // ── Live translation ────────────────────────────────────────────────────────
  try {
    const requests = TARGET_LANGUAGES.map((target) =>
      fetch(`${GOOGLE_TRANSLATE_URL}?key=${GOOGLE_TRANSLATE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: sourceLang,
          target,
          format: 'text', // plain text (not HTML)
        }),
      }).then((r) => r.json())
    );

    const [esResponse, viResponse] = await Promise.all(requests);

    return {
      es: esResponse?.data?.translations?.[0]?.translatedText ?? text,
      vi: viResponse?.data?.translations?.[0]?.translatedText ?? text,
    };
  } catch (err) {
    console.error('[translationService] Translation API call failed:', err);
    // Always fall back to original text — never block expert profile saves
    return { es: text, vi: text };
  }
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
