/**
 * src/pages/BookingCustody.tsx
 * EquipSync – Chain of Custody verification page with QR scanner, multi-angle
 * photo capture, quality gate, owner inspection, and cryptographic audit log.
 */

import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Copy,
  AlertTriangle,
  AlertCircle,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { GlassCard } from '@/components/shared/GlassCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { BookingLifecycle } from '@/components/shared/BookingLifecycle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useCustody } from '@/hooks/useCustody';
import { useAuth } from '@/providers/AuthProvider';
import {
  CustodyStepperFlow,
  OwnerInspectionPanel,
  CustodyTimelineFeed,
} from '@/features/custody';
import { toastError } from '@/lib/errors';
import { toast } from 'sonner';
import type { Database } from '@/lib/database.types';

type ConditionRating = Database['public']['Enums']['condition_rating'];

export function BookingCustody() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const {
    custody,
    booking,
    requiredPhotoSlots,
    accessories,
    photos,
    signedPhotoUrls,
    events,
    incidents,
    timeline,
    loading,
    refetch,
    reportIncident,
  } = useCustody(id || 'bk-2024-001');

  // Incident reporting state
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [incidentType, setIncidentType] = useState<'damage' | 'missing_accessory' | 'other'>('damage');
  const [incidentSeverity, setIncidentSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [incidentDesc, setIncidentDesc] = useState('');

  // Extract checkout and return events for state diffs
  const checkoutEvent = useMemo(
    () => events.find((e) => e.phase === 'checkout'),
    [events]
  );
  const returnEvent = useMemo(
    () => events.find((e) => e.phase === 'checkin'),
    [events]
  );

  const checkoutAccessoryStates = useMemo(() => {
    const map: Record<string, string> = {};
    if (checkoutEvent && Array.isArray(checkoutEvent.accessory_checks)) {
      for (const item of checkoutEvent.accessory_checks as Array<Record<string, unknown>>) {
        if (item.accessory_id) {
          map[String(item.accessory_id)] = String(item.state || 'present');
        }
      }
    }
    return map;
  }, [checkoutEvent]);

  const returnAccessoryStates = useMemo(() => {
    const map: Record<string, string> = {};
    if (returnEvent && Array.isArray(returnEvent.accessory_checks)) {
      for (const item of returnEvent.accessory_checks as Array<Record<string, unknown>>) {
        if (item.accessory_id) {
          map[String(item.accessory_id)] = String(item.state || 'present');
        }
      }
    }
    return map;
  }, [returnEvent]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-20 bg-muted/40 rounded-2xl" />
        <div className="h-64 bg-muted/30 rounded-2xl" />
      </div>
    );
  }

  if (!booking || !custody) {
    return (
      <div className="surface p-12 text-center rounded-2xl space-y-4">
        <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-foreground">Reservation Not Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            This reservation could not be found or you do not have permission to view its custody record.
          </p>
        </div>
        <Link to="/app/custody">
          <Button variant="outline" size="sm">
            Go to Chain of Custody Hub
          </Button>
        </Link>
      </div>
    );
  }

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    toast.success(`Verification code copied: ${code}`);
  };

  const isEligibleForHandover = booking?.status === 'approved';
  const isEligibleForReturn = booking?.status === 'checked_out';
  const isPendingInspection = booking?.status === 'returned' && role === 'institution';

  const handleReportIncident = async () => {
    if (!incidentDesc.trim()) {
      toast.error('Please enter a description of the issue');
      return;
    }
    try {
      await reportIncident({
        severity: incidentSeverity,
        type: incidentType,
        description: incidentDesc,
      });
      setShowIncidentForm(false);
      setIncidentDesc('');
      void refetch();
    } catch (err: unknown) {
      toastError(err, 'Failed to report incident');
    }
  };

  const returnPasscode = booking ? `RT-${booking.id.slice(-4).toUpperCase()}` : 'RT-3391';
  const expectedQr = booking?.resources?.qr_identifier || booking?.resource_id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/app/discover">
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Catalog</span>
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowIncidentForm(!showIncidentForm)}
          className="h-8 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Report Incident</span>
        </Button>
      </div>

      <PageHeader
        eyebrow="Chain of Custody Verification"
        title="Digital Custody Audit Trail"
        description="Immutable record tracking authorized custody transfers, condition state audits, and cryptographic return verifications."
      >
        <Badge
          variant="outline"
          className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1.5 font-bold py-1 px-3"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Custody Status: {custody.custodyStatus.toUpperCase()}</span>
        </Badge>
      </PageHeader>

      {/* Booking Lifecycle Stepper */}
      <div className="surface p-5 rounded-2xl border border-border/80 shadow-xs">
        <BookingLifecycle
          status={booking.status}
          createdAt={booking.created_at}
          decidedAt={booking.decided_at}
          decisionNote={booking.decision_note}
        />
      </div>

      {/* Status Warning & Lock Alerts */}
      {booking.status === 'pending' && (
        <div className="surface p-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 flex items-start gap-3.5 text-xs animate-fade-in shadow-xs">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-sm text-foreground block">
              Waiting for Administrator Approval
            </span>
            <p className="text-muted-foreground leading-relaxed">
              Waiting for admin approval. You can check out once your request is approved.
            </p>
          </div>
        </div>
      )}

      {booking.status === 'rejected' && (
        <div className="surface p-6 rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-3.5 text-xs animate-fade-in shadow-xs">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-sm block">Reservation Request Declined</span>
            <p className="leading-relaxed">
              This reservation was declined by an administrator
              {booking.decision_note ? `: "${booking.decision_note}"` : '.'}
            </p>
          </div>
        </div>
      )}

      {booking.status === 'cancelled' && (
        <div className="surface p-6 rounded-2xl border border-border bg-muted/40 text-muted-foreground flex items-start gap-3.5 text-xs animate-fade-in shadow-xs">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-foreground" />
          <div className="space-y-1">
            <span className="font-bold text-sm text-foreground block">Reservation Cancelled</span>
            <p className="leading-relaxed">
              This reservation has been cancelled
              {booking.decision_note ? `: "${booking.decision_note}"` : '.'}
            </p>
          </div>
        </div>
      )}

      {/* Incident Report Collapsible Form */}
      {showIncidentForm && (
        <div className="surface p-5 rounded-2xl border border-destructive/40 bg-destructive/5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <h4 className="text-sm font-bold text-foreground">File Incident Report</h4>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => setShowIncidentForm(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="font-semibold block mb-1">Issue Type</label>
              <select
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value as never)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
              >
                <option value="damage">Equipment Damage</option>
                <option value="missing_accessory">Missing Accessory</option>
                <option value="other">Other Irregularity</option>
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-1">Severity Level</label>
              <select
                value={incidentSeverity}
                onChange={(e) => setIncidentSeverity(e.target.value as never)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
              >
                <option value="low">Low (Cosmetic wear)</option>
                <option value="medium">Medium (Requires servicing)</option>
                <option value="high">High (Broken / unusable)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">Description of Issue</label>
            <Textarea
              placeholder="Describe physical damage, missing components, or malfunction details..."
              value={incidentDesc}
              onChange={(e) => setIncidentDesc(e.target.value)}
              className="text-xs"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowIncidentForm(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" onClick={handleReportIncident}>
              Submit Incident Report
            </Button>
          </div>
        </div>
      )}

      {/* Custody Overview Glass Card */}
      <GlassCard accent="green" className="rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <img
              src={custody.resourceImage}
              alt={custody.resourceTitle}
              className="h-20 w-20 md:h-24 md:w-24 rounded-xl object-cover border border-emerald-500/30 shrink-0 shadow-sm"
            />
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Record #{custody.id} • Booking #{custody.bookingId}
              </span>
              <h3 className="text-xl font-bold text-foreground">
                {custody.resourceTitle}
              </h3>
              <p className="text-xs text-muted-foreground">
                Active Borrower: <span className="font-semibold text-foreground">{custody.borrowerName}</span> ({custody.borrowerDepartment})
              </p>
              <div className="pt-1 flex items-center gap-2">
                <StatusBadge status={booking?.status === 'checked_out' ? 'active' : (booking?.status === 'approved' ? 'approved' : 'pending')} />
                <span className="text-xs text-muted-foreground">
                  Current Custodian: <strong className="text-foreground">{custody.currentCustodian}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Handover Verification Card */}
          <div className="surface p-4 rounded-xl border border-border/80 flex flex-col items-center justify-center min-w-[220px] text-center space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Return Verification Passcode
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-black tracking-widest text-primary">
                {returnPasscode}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => copyCode(returnPasscode)}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <span className="text-[10px] text-muted-foreground">
              Provide to locker desk upon return inspection
            </span>
          </div>
        </div>
      </GlassCard>

      {/* 4-Step Interactive Custody Handover / Return Flow */}
      {(isEligibleForHandover || isEligibleForReturn) && (
        <CustodyStepperFlow
          bookingId={custody.bookingId}
          phase={isEligibleForHandover ? 'checkout' : 'return'}
          expectedQr={expectedQr}
          requiredPhotoSlots={requiredPhotoSlots}
          accessories={accessories}
          checkoutAccessoryStates={checkoutAccessoryStates}
          onSuccess={() => void refetch()}
        />
      )}

      {/* Admin Return Inspection & Side-by-Side Evidence Panel */}
      {isPendingInspection && (
        <OwnerInspectionPanel
          bookingId={custody.bookingId}
          checkoutCondition={checkoutEvent?.condition}
          returnCondition={returnEvent?.condition}
          borrowerNotes={returnEvent?.notes || undefined}
          accessories={accessories}
          checkoutAccessoryStates={checkoutAccessoryStates}
          returnAccessoryStates={returnAccessoryStates}
          photos={photos}
          signedPhotoUrls={signedPhotoUrls}
          onInspected={() => void refetch()}
        />
      )}

      {/* Real-Time Custody Audit Feed */}
      <div className="surface p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Cryptographic Event Trail
            </h3>
            <p className="text-xs text-muted-foreground">
              Timestamped audit actions, QR scans, and SHA-256 photo hash verification events
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {timeline.length} Event(s)
          </Badge>
        </div>

        <CustodyTimelineFeed timeline={timeline} />
      </div>

      {/* Custody Stage Stepper */}
      <div className="surface p-6 rounded-2xl space-y-6">
        <div>
          <h3 className="text-base font-bold text-foreground">
            Custody Lifecycle Audit Trail
          </h3>
          <p className="text-xs text-muted-foreground">
            Complete chronological steps and department endorsements
          </p>
        </div>

        <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-2.5 sm:before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border">
          {custody.steps.map((step, idx) => {
            const isCompleted = step.status === 'completed';
            const isCurrent = step.status === 'current';
            const isUpcoming = step.status === 'upcoming';

            return (
              <div key={step.id} className="relative">
                <div
                  className={`absolute -left-6 sm:-left-8 top-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors ${
                    isCompleted
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                      : isCurrent
                      ? 'bg-primary border-primary text-white ring-4 ring-primary/20 animate-pulse'
                      : 'bg-card border-border text-muted-foreground'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <span className="text-[11px] font-bold">{idx + 1}</span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4
                      className={`text-sm font-bold ${
                        isCurrent
                          ? 'text-primary'
                          : isCompleted
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {step.stage}
                    </h4>

                    {isCompleted && (
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                        Completed
                      </Badge>
                    )}
                    {isCurrent && (
                      <Badge variant="default" className="text-[10px]">
                        Active Stage
                      </Badge>
                    )}
                    {isUpcoming && (
                      <Badge variant="secondary" className="text-[10px]">
                        Upcoming
                      </Badge>
                    )}

                    {step.timestamp && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {step.timestamp}
                      </span>
                    )}
                  </div>

                  {step.actorName && (
                    <p className="text-xs text-muted-foreground">
                      Verified by <strong className="text-foreground">{step.actorName}</strong> ({step.actorRole})
                    </p>
                  )}

                  {step.notes && (
                    <p className="text-xs text-muted-foreground/90 bg-muted/40 p-2.5 rounded-lg border border-border/50 mt-1.5 leading-relaxed">
                      {step.notes}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
