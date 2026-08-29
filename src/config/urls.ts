/**
 * External destinations the app sends people to.
 *
 * LANDING_URL is where a logged-out visitor to `/` gets redirected (see
 * Splash.tsx) — in production, the Framer marketing site.
 *
 * It is environment-driven because a hardcoded value sends every non-production
 * environment's front door to the production marketing site: locally you are
 * bounced off localhost before you can reach the signup page, and once
 * staging.whisperoo.app exists its root would hand visitors to production.
 *
 * Set VITE_LANDING_URL in .env.staging (and any local override) to keep an
 * environment self-contained. A relative path such as `/auth/create` is valid —
 * window.location.replace accepts one — and keeps the visitor in the current
 * environment instead of leaving it.
 *
 * The fallback is production, so .env needs no change and production behaviour
 * is unchanged.
 */
export const LANDING_URL = import.meta.env.VITE_LANDING_URL || 'https://whisperoo.app';

export const APP_URL = import.meta.env.VITE_APP_URL || 'https://app.whisperoo.app';
