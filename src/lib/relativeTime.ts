/**
 * "2 hours ago" / "hace 2 horas" / "2 giờ trước" — in the UI language. Pair it with
 * the exact timestamp in a title attribute (see exactTime) so nothing is lost.
 */
const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

export function relativeTime(iso: string, locale?: string, now: number = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(0, 'second'); // "now"
}

export function exactTime(iso: string, locale?: string): string {
  return new Date(iso).toLocaleString(locale);
}
