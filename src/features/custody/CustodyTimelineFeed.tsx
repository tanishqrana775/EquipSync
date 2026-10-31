/**
 * src/features/custody/CustodyTimelineFeed.tsx
 * EquipSync – Chronological feed of custody events, status shifts, and audit logs.
 * Includes hash chips, flagged badges, actor roles, and event icons.
 */

import React from 'react';
import {
  QrCode,
  Camera,
  CheckCircle2,
  AlertTriangle,
  History,
  FileCheck2,
  Clock,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CustodyTimelineItem } from '@/lib/api/rpc';
import { cn } from '@/lib/utils';

export interface CustodyTimelineFeedProps {
  timeline: CustodyTimelineItem[];
  className?: string;
}

export function CustodyTimelineFeed({ timeline, className }: CustodyTimelineFeedProps) {
  if (timeline.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-muted-foreground border rounded-2xl bg-muted/20">
        No custody audit events recorded yet.
      </div>
    );
  }

  const getEventIcon = (item: CustodyTimelineItem) => {
    const action = String(item.action || item.type || '');
    if (action.includes('qr')) return <QrCode className="h-4 w-4 text-primary" />;
    if (action.includes('photo')) return <Camera className="h-4 w-4 text-sky-500" />;
    if (action.includes('dispute')) return <AlertTriangle className="h-4 w-4 text-destructive" />;
    if (action.includes('incident')) return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    if (action.includes('checkout') || action.includes('accepted'))
      return <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
    if (action.includes('return') || action.includes('inspected'))
      return <FileCheck2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className={cn('flow-root space-y-4', className)}>
      <ul className="-mb-8">
        {timeline.map((event, idx) => {
          const isLast = idx === timeline.length - 1;
          const meta = (event.metadata as Record<string, unknown>) || {};
          const isFlagged = Boolean(event.flagged);
          const flagReasons = Array.isArray(event.flag_reasons) ? event.flag_reasons : [];

          return (
            <li key={idx} className="relative pb-6">
              {!isLast && (
                <span
                  className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-border/60"
                  aria-hidden="true"
                />
              )}
              <div className="relative flex items-start space-x-3.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card shadow-xs shrink-0">
                  {getEventIcon(event)}
                </div>

                <div className="min-w-0 flex-1 pt-0.5 text-xs space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-bold text-foreground">
                      {String(event.action || event.type).replace('custody.', '').replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(event.occurred_at).toLocaleString([], {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>

                  <div className="text-muted-foreground text-[11px] leading-relaxed">
                    By <strong className="text-foreground">{String(event.actor_name || 'System')}</strong>
                    {Boolean(event.actor_role) && (
                      <span className="opacity-75"> ({String(event.actor_role)})</span>
                    )}
                  </div>

                  {/* Flagged Alert Banner */}
                  {isFlagged && (
                    <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-[11px] space-y-0.5">
                      <div className="flex items-center gap-1 font-bold">
                        <AlertTriangle className="h-3 w-3" /> Flagged Return
                      </div>
                      {flagReasons.map((r, rIdx) => (
                        <div key={rIdx} className="pl-4 text-[10px]">
                          • {String(r)}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Hash Prefix Chips */}
                  {Array.isArray(meta.hash_prefixes) && meta.hash_prefixes.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {meta.hash_prefixes.map((h: unknown, hIdx: number) => (
                        <span
                          key={hIdx}
                          className="font-mono text-[9px] bg-muted/60 border px-1.5 py-0.5 rounded text-foreground"
                        >
                          SHA: #{String(h)}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Notes / Descriptions */}
                  {Boolean(event.notes) && (
                    <p className="p-2 rounded-lg bg-muted/30 border border-border/50 text-[11px] text-foreground">
                      {String(event.notes)}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
