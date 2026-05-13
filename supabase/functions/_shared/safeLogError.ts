/**
 * Redact PHI/PII-adjacent fields from error logs (HIPAA C3).
 * Use for all Edge Function console logging of caught errors/objects.
 */

const SENSITIVE_KEYS = [
  "messages",
  "content",
  "first_name",
  "birth_date",
  "email",
  "phone",
  "personal_context",
  "summary",
  "user_query",
  "ai_response",
];

function sanitizeValue(key: string, v: unknown): unknown {
  if (SENSITIVE_KEYS.includes(key)) return "[REDACTED]";
  if (typeof v === "string" && v.length > 256) return v.slice(0, 256) + "…";
  return v;
}

export function safeLogError(label: string, err: unknown): void {
  if (typeof err !== "object" || err === null) {
    console.error(label, String(err).slice(0, 256));
    return;
  }
  const rec = err as Record<string, unknown>;
  const sanitized = Object.fromEntries(
    Object.entries(rec).map(([k, v]) => [k, sanitizeValue(k, v)]),
  );
  console.error(label, sanitized);
}
