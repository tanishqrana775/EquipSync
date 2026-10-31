/**
 * src/features/custody/CustodyChainTimeline.tsx
 * EquipSync – Vertical Chronological Custody Chain Timeline.
 * Features left rail, ConditionMeter, PhotoStrip, anonymized borrower redaction,
 * incident chips, dispute outcomes, and "Condition when you received it" highlight.
 */

import React from 'react';
import {
  ShieldCheck,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Camera,
  FileCheck2,
  Wrench,
  AlertCircle,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ConditionMeter } from '@/components/shared/ConditionMeter';
import { PhotoStrip } from './PhotoStrip';

export interface CustodySegment {
  booking_id?: string;
  audit_id?: string;
  kind: 'loan' | 'audit';
  redacted: boolean;
  borrower?: { id: string; name: string } | null;
  auditor?: { id: string; name: string } | null;
  created_at?: string;
  start_at?: string;
  end_at?: string;
  status?: string;
  condition?: string;
  rank?: number;
  notes?: string;
  flagged?: boolean;
  flag_reasons?: string[];
  photos?: any[];
  accessory_checks?: any[];
  checkout?: {
    at?: string;
    condition?: string;
    rank?: number;
    notes?: string;
    flagged?: boolean;
    flag_reasons?: string[];
    accessory_checks?: any[];
    photos?: any[];
  };
  return?: {
    at?: string;
    condition?: string;
    rank?: number;
    notes?: string;
    flagged?: boolean;
    flag_reasons?: string[];
    accessory_checks?: any[];
    photos?: any[];
  };
  inspection?: {
    at?: string;
    condition?: string;
    rank?: number;
    notes?: string;
  };
  incidents?: Array<{
    id: string;
    severity: string;
    type: string;
    description: string;
    status: string;
    created_at: string;
  }>;
  events?: Array<{
    action: string;
    actor_name: string;
    role: string;
    time: string;
    metadata: any;
  }>;
}

interface CustodyChainTimelineProps {
  segments: CustodySegment[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  isMember?: boolean;
}

export function CustodyChainTimeline({
  segments = [],
  isLoading,
  error,
  onRetry,
  isMember = false,
}: CustodyChainTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="surface p-6 rounded-2xl h-44 bg-muted/40" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="surface p-8 text-center rounded-2xl space-y-3">
        <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
        <h4 className="text-sm font-bold text-foreground">Failed to Load Custody Chain</h4>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">{error}</p>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry} className="text-xs">
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="surface p-8 text-center rounded-2xl space-y-2">
        <FileCheck2 className="h-8 w-8 text-muted-foreground mx-auto" />
        <h4 className="text-sm font-bold text-foreground">No Custody History Recorded</h4>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          No checkout or return custody transfers have been verified for this equipment yet.
        </p>
      </div>
    );
  }

  // Find prior redacted loan to highlight for member if viewing their own loan
  const priorRedactedLoan = segments.find((s) => s.redacted && s.return);

  return (
    <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-border/80">
      {/* For member: highlighted prior condition banner */}
      {isMember && priorRedactedLoan && priorRedactedLoan.return && (
        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/25 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            <h4 className="text-xs font-bold text-foreground">
              Condition When You Received It (Previous Borrower Verification)
            </h4>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            This cryptographic snapshot was captured by the preceding borrower upon return. It establishes baseline condition before your loan began and protects you from liability for pre-existing wear.
          </p>
          <div className="pt-1">
            <ConditionMeter
              rank={priorRedactedLoan.return.rank || 4}
              label={priorRedactedLoan.return.condition}
            />
          </div>
          {priorRedactedLoan.return.photos && priorRedactedLoan.return.photos.length > 0 && (
            <PhotoStrip
              photos={priorRedactedLoan.return.photos}
              title="Verified Prior Return Evidence"
            />
          )}
        </div>
      )}

      {segments.map((seg, idx) => {
        // Redacted previous borrower segment
        if (seg.redacted) {
          return (
            <div key={seg.booking_id || idx} className="relative group">
              <span className="absolute -left-[1.85rem] sm:-left-[2.1rem] top-4 h-3.5 w-3.5 rounded-full border-2 border-background bg-muted-foreground/60 shadow-xs" />

              <div className="surface p-5 rounded-2xl border border-border/80 space-y-3 bg-muted/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px] bg-muted">?</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-bold text-muted-foreground">
                      Previous borrower (anonymized)
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                      Redacted
                    </Badge>
                  </div>
                  {seg.return?.at && (
                    <span className="text-[11px] text-muted-foreground font-mono">
                      Returned: {new Date(seg.return.at).toLocaleString()}
                    </span>
                  )}
                </div>

                {seg.return && (
                  <div className="space-y-2 pt-1">
                    <ConditionMeter
                      rank={seg.return.rank || 4}
                      label={seg.return.condition}
                    />
                    {seg.return.photos && (
                      <PhotoStrip photos={seg.return.photos} />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        }

        // Spot audit segment (Admin only)
        if (seg.kind === 'audit') {
          return (
            <div key={seg.audit_id || idx} className="relative group">
              <span className="absolute -left-[1.85rem] sm:-left-[2.1rem] top-4 h-3.5 w-3.5 rounded-full border-2 border-background bg-blue-500 shadow-xs" />

              <div className="surface p-5 rounded-2xl border border-blue-500/30 bg-card shadow-xs space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 text-[10px]">
                      Spot Audit
                    </Badge>
                    <span className="text-xs font-semibold text-foreground">
                      Auditor: {seg.auditor?.name || 'Administrator'}
                    </span>
                  </div>
                  {seg.created_at && (
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {new Date(seg.created_at).toLocaleString()}
                    </span>
                  )}
                </div>

                <ConditionMeter rank={seg.rank || 4} label={seg.condition} />

                {seg.notes && (
                  <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-xl border border-border/50">
                    {seg.notes}
                  </p>
                )}

                {seg.photos && seg.photos.length > 0 && (
                  <PhotoStrip photos={seg.photos} bucket="asset-audit-photos" title="Audit Evidence Photos" />
                )}
              </div>
            </div>
          );
        }

        // Standard Loan Segment
        const hasIncident = seg.incidents && seg.incidents.length > 0;
        const checkoutRank = seg.checkout?.rank || 4;
        const returnRank = seg.return?.rank || checkoutRank;

        return (
          <div key={seg.booking_id || idx} className="relative group">
            <span
              className={`absolute -left-[1.85rem] sm:-left-[2.1rem] top-4 h-3.5 w-3.5 rounded-full border-2 border-background shadow-xs ${
                hasIncident || seg.return?.flagged
                  ? 'bg-destructive'
                  : 'bg-emerald-500'
              }`}
            />

            <div className="surface p-5 rounded-2xl border border-border/80 bg-card shadow-xs space-y-4">
              {/* Header: Borrower chip & timestamps */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-7 w-7 border border-border">
                    <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                      {seg.borrower?.name?.slice(0, 2).toUpperCase() || 'MB'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="text-xs font-bold text-foreground block">
                      {seg.borrower?.name || 'Member'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">Borrower</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase capitalize ml-1">
                    {seg.status}
                  </Badge>
                </div>

                <div className="text-right text-[11px] text-muted-foreground font-mono">
                  {seg.start_at && (
                    <span>
                      {new Date(seg.start_at).toLocaleDateString()} — {new Date(seg.end_at || '').toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Handover & Return Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Checkout Phase */}
                <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Check-out Handover</span>
                    </span>
                    {seg.checkout?.at && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(seg.checkout.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {seg.checkout && (
                    <>
                      <ConditionMeter rank={checkoutRank} label={seg.checkout.condition} size="sm" />
                      {seg.checkout.notes && (
                        <p className="text-[11px] text-muted-foreground italic">&ldquo;{seg.checkout.notes}&rdquo;</p>
                      )}
                      {seg.checkout.photos && (
                        <PhotoStrip photos={seg.checkout.photos} title="Check-out Photos" />
                      )}
                    </>
                  )}
                </div>

                {/* Return Phase */}
                <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5 text-primary" />
                      <span>Check-in Return</span>
                    </span>
                    {seg.return?.at && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(seg.return.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {seg.return ? (
                    <>
                      <ConditionMeter
                        rank={returnRank}
                        previousRank={checkoutRank}
                        label={seg.return.condition}
                        size="sm"
                      />
                      {seg.return.flagged && (
                        <Badge variant="destructive" className="text-[10px] gap-1">
                          <AlertTriangle className="h-3 w-3" /> Flagged Return
                        </Badge>
                      )}
                      {seg.return.notes && (
                        <p className="text-[11px] text-muted-foreground italic">&ldquo;{seg.return.notes}&rdquo;</p>
                      )}
                      {seg.return.photos && (
                        <PhotoStrip photos={seg.return.photos} title="Return Photos" />
                      )}
                    </>
                  ) : (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      Return inspection pending.
                    </div>
                  )}
                </div>
              </div>

              {/* Incidents & Disputes if present */}
              {hasIncident && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 space-y-1.5">
                  <span className="text-xs font-bold text-destructive flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4" /> Reported Incidents
                  </span>
                  {seg.incidents?.map((inc) => (
                    <div key={inc.id} className="text-xs text-foreground flex items-center justify-between">
                      <span>• {inc.description} ({inc.type})</span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {inc.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default CustodyChainTimeline;
