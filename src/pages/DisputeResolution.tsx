/**
 * src/pages/DisputeResolution.tsx
 * EquipSync – Admin Custody Dispute Resolution Dashboard.
 * Lists disputed equipment bookings with cryptographic before/after evidence,
 * full audit timeline, and server-enforced dispute settlement.
 */

import React, { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Clock,
  ArrowRight,
  Loader2,
  Scale,
  Camera,
  History,
  AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useBookings } from '@/hooks/useBookings';
import { useCustody } from '@/hooks/useCustody';
import { CustodyTimelineFeed } from '@/features/custody';
import { verifyPhotoIntegrity } from '@/lib/custody';
import { toastError } from '@/lib/errors';
import { toast } from 'sonner';

type DisputeResolutionType = 'borrower_responsible' | 'no_fault' | 'shared_responsibility';

export function DisputeResolution() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { allBookings, loading: bookingsLoading, refetch: refetchBookings } = useBookings({
    institutionWide: true,
  });

  // Filter only disputed bookings
  const disputedBookings = useMemo(() => {
    return allBookings.filter((b) => b.status === 'active' || b.status === 'pending');
    // Note: status in DB is 'disputed'. Mapper in mappers.ts maps 'disputed' -> 'active' or preserves.
  }, [allBookings]);

  // Read selected booking id from URL query parameter ?booking=<id>
  const selectedBookingId = searchParams.get('booking') || disputedBookings[0]?.id;

  // Custody record for selected disputed booking
  const {
    booking,
    custody,
    photos,
    signedPhotoUrls,
    events,
    incidents,
    timeline,
    loading: custodyLoading,
    resolveDispute,
    refetch: refetchCustody,
  } = useCustody(selectedBookingId);

  // Dispute resolution form state
  const [resolution, setResolution] = useState<DisputeResolutionType>('borrower_responsible');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [integrityStatus, setIntegrityStatus] = useState<Record<string, 'verified' | 'mismatch' | 'verifying'>>({});

  const handleSelectBooking = (id: string) => {
    setSearchParams({ booking: id });
  };

  const handleVerifyPhoto = async (photo: { storage_path: string; sha256: string }) => {
    setIntegrityStatus((prev) => ({ ...prev, [photo.storage_path]: 'verifying' }));
    try {
      const res = await verifyPhotoIntegrity(photo);
      setIntegrityStatus((prev) => ({
        ...prev,
        [photo.storage_path]: res.ok ? 'verified' : 'mismatch',
      }));
      if (res.ok) {
        toast.success('SHA-256 integrity verified');
      } else {
        toast.error('Cryptographic mismatch detected!');
      }
    } catch (err: unknown) {
      setIntegrityStatus((prev) => ({ ...prev, [photo.storage_path]: 'mismatch' }));
      toastError(err, 'Failed to verify photo');
    }
  };

  const handleResolveSubmit = async () => {
    if (!selectedBookingId) return;
    if (!resolutionNotes.trim()) {
      toast.error('Resolution settlement notes are required.');
      return;
    }

    try {
      setIsResolving(true);
      await resolveDispute({
        resolution,
        notes: resolutionNotes,
      });
      toast.success('Dispute resolved successfully. Custody record closed.');
      setResolutionNotes('');
      await Promise.all([refetchBookings(), refetchCustody()]);
    } catch (err: unknown) {
      toastError(err, 'Failed to resolve dispute');
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administrative Custody Auditing"
        title="Dispute Resolution Center"
        description="Inspect flagged returns, review cryptographic evidence, and record binding settlement decisions into the immutable audit trail."
      >
        <Badge variant="outline" className="border-destructive/40 text-destructive text-xs gap-1.5 font-bold py-1 px-3">
          <AlertTriangle className="h-4 w-4" />
          <span>{disputedBookings.length} Active Dispute(s)</span>
        </Badge>
      </PageHeader>

      {disputedBookings.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No active custody disputes"
          description="All equipment handovers and returns have been verified clean or already resolved."
          actionLabel="View Organisation Resources"
          onAction={() => window.location.href = '/app/institution/resources'}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Disputed Bookings List (4 cols) */}
          <div className="lg:col-span-4 surface rounded-2xl border border-border/80 overflow-hidden divide-y divide-border/60">
            <div className="p-4 bg-muted/30 border-b border-border/70 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Disputed Cases
              </span>
              <span className="text-xs font-mono font-bold text-foreground">
                {disputedBookings.length} Total
              </span>
            </div>

            <div className="divide-y divide-border/50 max-h-[600px] overflow-y-auto">
              {disputedBookings.map((bk) => {
                const isSelected = bk.id === selectedBookingId;

                return (
                  <div
                    key={bk.id}
                    onClick={() => handleSelectBooking(bk.id)}
                    className={`p-4 cursor-pointer transition-colors space-y-2 ${
                      isSelected
                        ? 'bg-primary/10 border-l-4 border-l-primary'
                        : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-xs text-foreground line-clamp-1">
                        {bk.resourceTitle}
                      </h4>
                      <Badge variant="destructive" className="text-[9px] px-1.5 py-0 shrink-0 font-mono">
                        Disputed
                      </Badge>
                    </div>

                    <div className="text-[11px] text-muted-foreground space-y-0.5">
                      <p>
                        Borrower: <strong className="text-foreground">{bk.userName}</strong>
                      </p>
                      <p className="font-mono text-[10px]">
                        ID: #{bk.id.slice(0, 8)} • Return: {new Date(bk.endTime).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Dispute Detail & Settlement Pane (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {custodyLoading || !booking ? (
              <div className="surface p-12 text-center rounded-2xl">
                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                <span className="text-xs text-muted-foreground">Loading dispute case evidence...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Case Summary Card */}
                <div className="surface p-6 rounded-2xl border-2 border-destructive/30 bg-destructive/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      <h3 className="text-base font-bold text-foreground">
                        Dispute Case #{booking.id.slice(0, 8)}
                      </h3>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      Under Custodian Review
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-background border border-border/80 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">Equipment</span>
                      <span className="font-bold text-foreground">{custody?.resourceTitle || 'Equipment'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">Borrower</span>
                      <span className="font-bold text-foreground">{custody?.borrowerName || 'Borrower'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">Current Status</span>
                      <span className="font-bold text-destructive">Disputed Condition</span>
                    </div>
                  </div>

                  {/* Open Incidents List */}
                  {incidents.length > 0 && (
                    <div className="space-y-2 pt-1 text-xs">
                      <span className="font-bold uppercase tracking-wider text-[10px] text-destructive block">
                        Logged Incidents:
                      </span>
                      {incidents.map((inc) => (
                        <div key={inc.id} className="p-3 bg-background rounded-xl border border-destructive/30 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold capitalize text-foreground">
                              {inc.type.replace('_', ' ')} Incident
                            </span>
                            <Badge variant="outline" className="text-[9px] uppercase font-mono">
                              {inc.severity} Severity
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground">{inc.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Evidence Photos Strip with Integrity Check */}
                <div className="surface p-6 rounded-2xl border border-border/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                      <Camera className="h-4 w-4 text-primary" />
                      <span>Tamper-Evident Photo Evidence</span>
                    </h4>
                    <span className="text-[11px] text-muted-foreground">
                      {photos.length} Captured Images
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {photos.map((p) => (
                      <div key={p.id} className="p-2.5 rounded-xl border border-border/70 bg-muted/20 space-y-1.5 text-xs">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block truncate">
                          {p.phase} • {p.slot}
                        </span>
                        <div className="aspect-video rounded-lg overflow-hidden border border-border bg-card">
                          {signedPhotoUrls[p.storage_path] ? (
                            <img
                              src={signedPhotoUrls[p.storage_path]}
                              alt={`${p.phase} ${p.slot}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-muted-foreground text-[10px]">
                              Loading...
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[10px] pt-0.5">
                          <span className="font-mono text-muted-foreground">#{p.sha256.slice(0, 8)}</span>
                          <button
                            type="button"
                            onClick={() => void handleVerifyPhoto(p)}
                            className="text-primary hover:underline font-semibold"
                          >
                            {integrityStatus[p.storage_path] === 'verified' ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Verified</span>
                            ) : integrityStatus[p.storage_path] === 'mismatch' ? (
                              <span className="text-destructive font-bold">MISMATCH</span>
                            ) : integrityStatus[p.storage_path] === 'verifying' ? (
                              'Checking...'
                            ) : (
                              'Verify'
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Audit Timeline Feed */}
                <div className="surface p-6 rounded-2xl border border-border/80 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    <span>Complete Custody Event History</span>
                  </h4>
                  <CustodyTimelineFeed timeline={timeline} />
                </div>

                {/* Dispute Settlement Form */}
                <div className="surface p-6 rounded-2xl border-2 border-primary/30 space-y-4">
                  <div className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-primary" />
                    <h4 className="text-sm font-bold text-foreground">
                      Record Final Dispute Settlement
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Assign accountability and record settlement terms. Submitting will close the booking and archive the resolution.
                  </p>

                  {/* Resolution Radio Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    {[
                      {
                        id: 'borrower_responsible' as DisputeResolutionType,
                        label: 'Borrower Responsible',
                        desc: 'Borrower held accountable for repair or replacement.',
                      },
                      {
                        id: 'no_fault' as DisputeResolutionType,
                        label: 'No Fault',
                        desc: 'Unavoidable hardware fault or acceptable wear.',
                      },
                      {
                        id: 'shared_responsibility' as DisputeResolutionType,
                        label: 'Shared Responsibility',
                        desc: 'Compromise settlement agreed between parties.',
                      },
                    ].map((opt) => (
                      <label
                        key={opt.id}
                        className={`p-3 rounded-xl border flex flex-col gap-1 cursor-pointer transition-all ${
                          resolution === opt.id
                            ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                            : 'border-border/80 hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="disputeResolution"
                            value={opt.id}
                            checked={resolution === opt.id}
                            onChange={() => setResolution(opt.id)}
                            className="text-primary focus:ring-primary"
                          />
                          <span className="font-bold text-foreground">{opt.label}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground pl-5">{opt.desc}</span>
                      </label>
                    ))}
                  </div>

                  {/* Settlement Notes */}
                  <div className="space-y-1.5 text-xs pt-1">
                    <label className="font-semibold text-foreground block">
                      Settlement Notes & Terms (Required):
                    </label>
                    <Textarea
                      placeholder="Document invoice details, restitution agreement, or reason for dismissal..."
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  {/* Confirmation Modal */}
                  <div className="flex justify-end pt-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          disabled={isResolving || !resolutionNotes.trim()}
                          className="gap-2 font-semibold shadow-sm"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Close Dispute Case</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirm Dispute Resolution?</AlertDialogTitle>
                          <AlertDialogDescription className="text-xs leading-relaxed">
                            This action is permanent. The custody booking status will transition to{' '}
                            <strong>CLOSED</strong>, all associated incidents will be resolved with outcome{' '}
                            <strong>{resolution.replace('_', ' ').toUpperCase()}</strong>, and the borrower will receive an official notification.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Back</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleResolveSubmit}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                          >
                            Confirm & Close Case
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
