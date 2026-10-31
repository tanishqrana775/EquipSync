/**
 * src/components/shared/BookingLifecycle.tsx
 * EquipSync - Accessible Horizontal Booking Lifecycle Stepper.
 * Stages: Requested -> Admin check -> Approved -> Checked out -> Returned -> Closed.
 * Handles Declined and Cancelled terminal states with admin decision notes.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import {
  Clock,
  ShieldCheck,
  CheckCircle2,
  Package,
  RotateCcw,
  Check,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

export interface BookingLifecycleProps {
  status: string;
  createdAt?: string;
  decidedAt?: string | null;
  decisionNote?: string | null;
  className?: string;
}

const STAGES = [
  { key: 'requested', label: 'Requested', icon: Clock },
  { key: 'admin_check', label: 'Admin check', icon: ShieldCheck },
  { key: 'approved', label: 'Approved', icon: CheckCircle2 },
  { key: 'checked_out', label: 'Checked out', icon: Package },
  { key: 'returned', label: 'Returned', icon: RotateCcw },
  { key: 'closed', label: 'Closed', icon: Check },
];

export function BookingLifecycle({
  status,
  createdAt,
  decidedAt,
  decisionNote,
  className,
}: BookingLifecycleProps) {
  const norm = (status || '').toLowerCase();

  // Determine current active step index (0-5)
  let activeIndex = 0;
  let isDeclined = false;
  let isCancelled = false;

  if (norm === 'pending') {
    activeIndex = 1;
  } else if (norm === 'approved') {
    activeIndex = 2;
  } else if (norm === 'checked_out' || norm === 'active') {
    activeIndex = 3;
  } else if (norm === 'returned') {
    activeIndex = 4;
  } else if (norm === 'closed' || norm === 'completed') {
    activeIndex = 5;
  } else if (norm === 'rejected') {
    isDeclined = true;
    activeIndex = 2;
  } else if (norm === 'cancelled') {
    isCancelled = true;
    activeIndex = 2;
  } else if (norm === 'disputed') {
    activeIndex = 4;
  }

  return (
    <div className={cn('space-y-3 py-1', className)}>
      {/* Horizontal Steps Bar */}
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-full bg-muted -z-0" />

        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isPassed = !isDeclined && !isCancelled && idx < activeIndex;
          const isCurrent = idx === activeIndex;

          let stepColor = 'bg-muted text-muted-foreground border-border';
          let textColor = 'text-muted-foreground font-medium';

          if (isPassed) {
            stepColor = 'bg-emerald-500 text-white border-emerald-500';
            textColor = 'text-foreground font-semibold';
          } else if (isCurrent) {
            if (isDeclined) {
              stepColor = 'bg-destructive text-white border-destructive animate-pulse';
              textColor = 'text-destructive font-bold';
            } else if (isCancelled) {
              stepColor = 'bg-muted-foreground text-white border-muted-foreground';
              textColor = 'text-muted-foreground font-bold';
            } else if (norm === 'pending') {
              stepColor = 'bg-amber-500 text-white border-amber-500 shadow-sm animate-pulse';
              textColor = 'text-amber-700 dark:text-amber-400 font-bold';
            } else {
              stepColor = 'bg-primary text-primary-foreground border-primary shadow-sm';
              textColor = 'text-primary font-bold';
            }
          }

          const label =
            isCurrent && isDeclined
              ? 'Declined'
              : isCurrent && isCancelled
              ? 'Cancelled'
              : stage.label;

          const DisplayIcon =
            isCurrent && isDeclined
              ? XCircle
              : isCurrent && isCancelled
              ? AlertTriangle
              : Icon;

          return (
            <div key={stage.key} className="flex flex-col items-center gap-1.5 z-10">
              <div
                className={cn(
                  'h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all duration-200',
                  stepColor
                )}
                title={label}
              >
                <DisplayIcon className="h-3.5 w-3.5" />
              </div>
              <span className={cn('text-[10px] whitespace-nowrap hidden sm:inline-block', textColor)}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Decision Note & Timestamp Detail */}
      {(decidedAt || decisionNote || createdAt) && (
        <div className="pt-1.5 flex flex-wrap items-center justify-between text-[11px] text-muted-foreground border-t border-border/40">
          <div>
            {createdAt && (
              <span>
                Requested: <span className="font-semibold text-foreground">{new Date(createdAt).toLocaleDateString()}</span>
              </span>
            )}
            {decidedAt && (
              <span className="ml-3">
                Decided: <span className="font-semibold text-foreground">{new Date(decidedAt).toLocaleString()}</span>
              </span>
            )}
          </div>
          {decisionNote && (
            <div className="text-muted-foreground italic truncate max-w-xs">
              Note: &ldquo;{decisionNote}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BookingLifecycle;
