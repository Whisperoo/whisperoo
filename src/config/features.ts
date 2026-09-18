/**
 * Build-time feature flags. Read from VITE_* vars, so each environment's
 * bundle bakes in its own value (see Dockerfile.fly for the build args).
 *
 * CONSENT_STEP_ENABLED — the messaging-consent onboarding step. Default OFF:
 * the consent copy is still the legal team's placeholder and SendGrid/Twilio
 * are not wired, so production must not show it until both land. Staging sets
 * VITE_CONSENT_STEP=true so the client can review the screen. When the flag is
 * off, /onboarding/consent forwards straight to /onboarding/complete and the
 * progress counter drops the step.
 */
export const CONSENT_STEP_ENABLED = import.meta.env.VITE_CONSENT_STEP === 'true';
