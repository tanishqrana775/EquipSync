/**
 * src/components/shared/ConditionMeter.tsx
 * EquipSync – Accessible 5-Point Condition Meter (Rank 1 to 5).
 * Danger-to-success token segments, label, and rank change delta indicator.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

export interface ConditionMeterProps {
  rank: number; // 1 to 5
  previousRank?: number; // 1 to 5
  label?: string;
  size?: 'sm' | 'default';
  className?: string;
}

const RANK_LABELS: Record<number, string> = {
  1: 'Non-functional',
  2: 'Damaged / Missing parts',
  3: 'Minor wear',
  4: 'Good',
  5: 'Excellent',
};

const RANK_COLORS: Record<number, string> = {
  1: 'bg-destructive text-destructive-foreground',
  2: 'bg-destructive/80 text-destructive-foreground',
  3: 'bg-amber-500 text-amber-950',
  4: 'bg-blue-500 text-white',
  5: 'bg-emerald-500 text-white',
};

export function ConditionMeter({
  rank,
  previousRank,
  label,
  size = 'default',
  className,
}: ConditionMeterProps) {
  const safeRank = Math.max(1, Math.min(5, Math.round(rank || 4)));
  const displayLabel = label || RANK_LABELS[safeRank] || 'Good';

  const delta = previousRank !== undefined ? safeRank - previousRank : 0;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-foreground">Condition Rank {safeRank}/5</span>
          <span className="text-muted-foreground font-medium">({displayLabel})</span>
        </div>

        {previousRank !== undefined && previousRank > 0 && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md',
              delta < 0
                ? 'bg-destructive/10 text-destructive'
                : delta > 0
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {delta < 0 ? (
              <>
                <ArrowDownRight className="h-3 w-3" />
                <span>{previousRank} to {safeRank} ({delta} worsened)</span>
              </>
            ) : delta > 0 ? (
              <>
                <ArrowUpRight className="h-3 w-3" />
                <span>{previousRank} to {safeRank} (+{delta} improved)</span>
              </>
            ) : (
              <>
                <Minus className="h-3 w-3" />
                <span>No condition change</span>
              </>
            )}
          </span>
        )}
      </div>

      {/* 5 Segments */}
      <div className="flex gap-1 h-2">
        {[1, 2, 3, 4, 5].map((seg) => (
          <div
            key={seg}
            className={cn(
              'flex-1 rounded-full transition-colors duration-200',
              seg <= safeRank ? RANK_COLORS[safeRank] : 'bg-muted/70'
            )}
          />
        ))}
      </div>
    </div>
  );
}

export default ConditionMeter;
