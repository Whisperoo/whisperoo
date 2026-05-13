/** Format a raw digit sequence as `(XXX) XXX-XXXX`. Returns the partial format for fewer digits. */
export function formatUsPhone(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  if (d.length === 0) return '';
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export const PHONE_PATTERN = /^\(\d{3}\) \d{3}-\d{4}$/;

export function isValidUsPhone(value: string): boolean {
  return PHONE_PATTERN.test(value);
}
