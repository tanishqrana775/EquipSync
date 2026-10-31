/**
 * src/components/shared/LiveBadge.tsx
 * EquipSync – Accessible Realtime Status Indicator.
 * Renders ONLY a pulse dot (no text): success color when connected,
 * warning color when reconnecting, motion-reduce:animate-none, h-2.5 w-2.5 rounded-full.
 * Includes role="status", aria-label and title for accessibility.
 */

import React from 'react';
import { useRealtimeStatus } from '@/lib/realtimeStatus';
import { cn } from '@/lib/utils';

export { useRealtimeStatus };

export interface LiveBadgeProps {
  connected?: boolean;
  className?: string;
}

export function LiveBadge({
  connected: connectedProp,
  className,
}: LiveBadgeProps) {
  const storeConnected = useRealtimeStatus();
  const isLive = connectedProp !== undefined ? connectedProp : storeConnected;
  const statusLabel = isLive ? 'Live' : 'Reconnecting';

  return (
    <span
      role="status"
      aria-label={statusLabel}
      title={statusLabel}
      className={cn(
        'relative inline-flex items-center justify-center shrink-0',
        className
      )}
    >
      <span
        className={cn(
          'absolute inline-flex h-full w-full rounded-full opacity-75 motion-reduce:animate-none animate-ping',
          isLive ? 'bg-emerald-400' : 'bg-amber-400'
        )}
      />
      <span
        className={cn(
          'relative inline-flex h-2.5 w-2.5 rounded-full motion-reduce:animate-none animate-pulse',
          isLive
            ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
            : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
        )}
      />
      <span className="sr-only">{statusLabel}</span>
    </span>
  );
}

export default LiveBadge;
