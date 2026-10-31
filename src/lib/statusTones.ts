/**
 * One status palette for the admin portal, by MEANING rather than by screen, so the
 * same colour always says the same thing (user request 2026-10-31):
 *
 *   urgent  red    something is wrong or needs attention now (urgent, unpaid)
 *   new     blue   waiting for someone to act (new request, pending appointment)
 *   active  amber  being worked on (in progress, confirmed)
 *   done    green  finished (done, completed, paid)
 *   muted   gray   inactive (cancelled, refunded, free)
 */
export type StatusTone = 'urgent' | 'new' | 'active' | 'done' | 'muted';

export const TONE_CLASSES: Record<StatusTone, string> = {
  urgent: 'bg-red-50 text-red-700 border border-red-200',
  new: 'bg-blue-50 text-blue-700 border border-blue-200',
  active: 'bg-amber-50 text-amber-700 border border-amber-200',
  done: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  muted: 'bg-gray-100 text-gray-500 border border-gray-200',
};
