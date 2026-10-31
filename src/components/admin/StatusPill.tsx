import React from 'react';
import { cn } from '@/lib/utils';
import { TONE_CLASSES, type StatusTone } from '@/lib/statusTones';

/** A status label in the portal-wide palette (see lib/statusTones). */
const StatusPill: React.FC<{ tone: StatusTone; children: React.ReactNode; className?: string }> = ({
  tone,
  children,
  className,
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap',
      TONE_CLASSES[tone],
      className,
    )}
  >
    {children}
  </span>
);

export default StatusPill;
