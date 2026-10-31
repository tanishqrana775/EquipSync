/**
 * src/pages/BookingRequests.tsx
 * EquipSync - Enterprise Administrative Request Queue & Hardened Approval Pipeline.
 * Route: /app/institution/requests
 * Features:
 * 1. Filter tabs: Pending Review, Approved (Upcoming), and History.
 * 2. Overlap collision detector highlighting slot_taken hazards.
 * 3. Detail inspection Sheet with member borrowing track record.
 * 4. Hardened Approve, Reject, and Revoke approval actions with decision notes.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useBookings } from '@/hooks/useBookings';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { BookingLifecycle } from '@/components/shared/BookingLifecycle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Building,
  User,
  Calendar,
  Layers,
  ArrowRight,
  Loader2,
  Undo2,
  History,
  FileText,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { toastError } from '@/lib/errors';
import type { Booking } from '@/lib/types';

export function BookingRequests() {
  const { profile } = useAuth();
  const institutionId = profile?.institution_id;

  const {
    bookings,
    loading,
    decideBooking,
    adminCancelBooking,
    refetch,
  } = useBookings({ institutionWide: true });

  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'history'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected booking for detailed Sheet view
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Approval / Rejection modal state
  const [decisionModal, setDecisionModal] = useState<{
    booking: Booking;
    approve: boolean;
  } | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  // Revocation modal state
  const [revokeBooking, setRevokeBooking] = useState<Booking | null>(null);
  const [revokeNote, setRevokeNote] = useState('');
  const [isRevoking, setIsRevoking] = useState(false);

  // ---------------------------------------------------------------------------
  // Member Historical Loans Query for the open Sheet
  // ---------------------------------------------------------------------------
  const { data: memberHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ['member_resource_history', selectedBooking?.user_id, selectedBooking?.resource_id],
    queryFn: async () => {
      const uId = selectedBooking?.userId || selectedBooking?.user_id;
      const rId = selectedBooking?.resourceId || selectedBooking?.resource_id;
      if (!uId || !rId) return [];
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id, start_at, end_at, status, decision_note, created_at,
          resources(name)
        `)
        .eq('user_id', uId)
        .eq('resource_id', rId)
        .neq('id', selectedBooking.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) return [];
      return data || [];
    },
    enabled: !!(selectedBooking?.userId || selectedBooking?.user_id) && !!(selectedBooking?.resourceId || selectedBooking?.resource_id),
  });

  // ---------------------------------------------------------------------------
  // Overlap Collision Detection
  // Check if an approved/checked_out booking overlaps with any pending booking
  // ---------------------------------------------------------------------------
  const approvedBookings = useMemo(() => {
    return bookings.filter((b) => b.status === 'approved' || b.status === 'checked_out');
  }, [bookings]);

  const hasOverlap = (target: Booking): boolean => {
    const targetStart = new Date(target.startTime || target.start_at || '').getTime();
    const targetEnd = new Date(target.endTime || target.end_at || '').getTime();

    return approvedBookings.some((b) => {
      const bResId = b.resourceId || b.resource_id;
      const tResId = target.resourceId || target.resource_id;
      if (b.id === target.id || bResId !== tResId) return false;
      const start = new Date(b.startTime || b.start_at || '').getTime();
      const end = new Date(b.endTime || b.end_at || '').getTime();
      return targetStart < end && targetEnd > start;
    });
  };

  // ---------------------------------------------------------------------------
  // Categorized Bookings
  // ---------------------------------------------------------------------------
  const pendingRequests = useMemo(() => {
    return bookings.filter((b) => b.status === 'pending');
  }, [bookings]);

  const upcomingApproved = useMemo(() => {
    const now = Date.now();
    return bookings.filter((b) => b.status === 'approved' && new Date(b.endTime || b.end_at || '').getTime() >= now);
  }, [bookings]);

  const historyBookings = useMemo(() => {
    return bookings.filter((b) => b.status !== 'pending' && b.status !== 'approved');
  }, [bookings]);

  // Tab items filtered by search
  const displayedBookings = useMemo(() => {
    const source =
      activeTab === 'pending'
        ? pendingRequests
        : activeTab === 'approved'
        ? upcomingApproved
        : historyBookings;

    if (!searchQuery.trim()) return source;
    const q = searchQuery.toLowerCase().trim();
    return source.filter((b) => {
      const resName = (b.resource?.name || b.resource_name || '').toLowerCase();
      const userName = (b.userName || b.user_id || '').toLowerCase();
      const purpose = (b.purpose || '').toLowerCase();
      return resName.includes(q) || userName.includes(q) || purpose.includes(q);
    });
  }, [activeTab, pendingRequests, upcomingApproved, historyBookings, searchQuery]);

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------
  const handleConfirmDecision = async () => {
    if (!decisionModal) return;
    try {
      setIsSubmittingDecision(true);
      await decideBooking({
        bookingId: decisionModal.booking.id,
        approve: decisionModal.approve,
        note: decisionNote.trim() || undefined,
      });
      setDecisionModal(null);
      setDecisionNote('');
      if (selectedBooking?.id === decisionModal.booking.id) {
        setSelectedBooking(null);
      }
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('slot_taken')) {
        toast.error('Cannot approve: this time slot conflicts with an existing approved booking.');
      } else if (msg.includes('invalid_state')) {
        toast.error('Another administrator already handled this request.');
      } else {
        toastError(err, 'Failed to record decision');
      }
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const handleConfirmRevocation = async () => {
    if (!revokeBooking) return;
    try {
      setIsRevoking(true);
      await adminCancelBooking({
        bookingId: revokeBooking.id,
        note: revokeNote.trim() || undefined,
      });
      setRevokeBooking(null);
      setRevokeNote('');
      if (selectedBooking?.id === revokeBooking.id) {
        setSelectedBooking(null);
      }
      refetch();
    } catch (err) {
      toastError(err, 'Failed to revoke approved reservation');
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administrative Workflow"
        title="Request Queue"
        description="Review, verify, and approve member reservations with automated overlap detection and waitlist return triggers."
      >
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1">
            Total Requests: {bookings.length}
          </Badge>
        </div>
      </PageHeader>

      {/* KPI Overview Chips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="surface p-4 rounded-2xl border border-border/80 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-500" /> Pending Review
            </span>
            <div className="text-2xl font-black text-foreground">{pendingRequests.length}</div>
          </div>
          <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs">
            Action required
          </Badge>
        </div>

        <div className="surface p-4 rounded-2xl border border-border/80 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Approved Upcoming
            </span>
            <div className="text-2xl font-black text-foreground">{upcomingApproved.length}</div>
          </div>
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Awaiting checkout
          </Badge>
        </div>

        <div className="surface p-4 rounded-2xl border border-border/80 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <History className="h-4 w-4 text-primary" /> Past & Inactive
            </span>
            <div className="text-2xl font-black text-foreground">{historyBookings.length}</div>
          </div>
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Archived
          </Badge>
        </div>
      </div>

      {/* Tabs & Search Controls */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <TabsList className="p-1 rounded-xl bg-muted/60">
            <TabsTrigger value="pending" className="gap-1.5 text-xs font-semibold rounded-lg">
              <span>Pending Check</span>
              {pendingRequests.length > 0 && (
                <Badge className="h-5 px-1.5 text-[10px] bg-amber-500 text-white rounded-full">
                  {pendingRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-1.5 text-xs font-semibold rounded-lg">
              <span>Approved Upcoming</span>
              <span className="text-[10px] text-muted-foreground">({upcomingApproved.length})</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs font-semibold rounded-lg">
              <span>History</span>
              <span className="text-[10px] text-muted-foreground">({historyBookings.length})</span>
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search member, asset..."
              className="pl-8 text-xs h-9 rounded-xl"
            />
          </div>
        </div>

        {/* Content Table / Cards */}
        <TabsContent value={activeTab} className="space-y-3 mt-2">
          {displayedBookings.length === 0 ? (
            <div className="surface p-12 text-center rounded-2xl border border-border/80 space-y-2">
              <Layers className="h-8 w-8 text-muted-foreground/50 mx-auto" />
              <h4 className="text-sm font-bold text-foreground">No reservations in this queue</h4>
              <p className="text-xs text-muted-foreground">
                {activeTab === 'pending'
                  ? 'All member requests have been reviewed and decided.'
                  : 'No reservations match your current filter.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedBookings.map((b) => {
                const overlap = b.status === 'pending' && hasOverlap(b);
                const resName = b.resource?.name || b.resource_name || 'Equipment Item';
                const memberName = b.userName || 'Member';
                const startDate = new Date(b.startTime || b.start_at || '');
                const endDate = new Date(b.endTime || b.end_at || '');
                const canRevoke = b.status === 'approved' && Date.now() < startDate.getTime();

                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBooking(b)}
                    className="surface p-4 sm:p-5 rounded-2xl border border-border/80 shadow-xs hover:border-primary/40 transition-all cursor-pointer space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-border/60">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground text-sm">{memberName}</span>
                            <Badge variant="outline" className="text-[10px] font-semibold py-0">
                              Verified
                            </Badge>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            Requested {new Date(b.createdAt || b.created_at || '').toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {overlap && (
                          <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] font-bold gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Overlap Warning</span>
                          </Badge>
                        )}
                        <StatusBadge
                          status={b.status}
                          decisionNote={b.decision_note}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">Asset</span>
                        <span className="font-semibold text-foreground text-sm truncate block">{resName}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">Reservation Window</span>
                        <span className="font-mono text-foreground block">
                          {startDate.toLocaleDateString()} {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">Supervisor / Purpose</span>
                        <span className="text-muted-foreground truncate block">
                          {b.supervisor_name ? `Sup: ${b.supervisor_name}` : b.purpose || 'Academic / Research'}
                        </span>
                      </div>
                    </div>

                    {/* Action Bar for Card */}
                    <div className="pt-2 flex items-center justify-between border-t border-border/40">
                      <span className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1">
                        <span>View details & history</span>
                        <ArrowRight className="h-3 w-3" />
                      </span>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {b.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setDecisionModal({ booking: b, approve: false });
                                setDecisionNote('');
                              }}
                              className="text-xs h-8 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              <span>Decline</span>
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                setDecisionModal({ booking: b, approve: true });
                                setDecisionNote('');
                              }}
                              className="text-xs h-8 font-semibold gap-1 shadow-xs"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Approve</span>
                            </Button>
                          </>
                        )}

                        {canRevoke && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRevokeBooking(b);
                              setRevokeNote('');
                            }}
                            className="text-xs h-8 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                            <span>Revoke Approval</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------------------------- */}
      {/* Detail Inspection Sheet                                             */}
      {/* ------------------------------------------------------------------- */}
      {selectedBooking && (
        <Sheet open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
          <SheetContent className="sm:max-w-lg space-y-5 overflow-y-auto">
            <SheetHeader className="space-y-1 text-left border-b border-border/60 pb-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Reservation Inspection</span>
                <StatusBadge status={selectedBooking.status} decisionNote={selectedBooking.decision_note} />
              </div>
              <SheetTitle className="text-lg font-bold text-foreground">
                {selectedBooking.resource?.name || selectedBooking.resource_name || 'Equipment Item'}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Borrower: <span className="font-semibold text-foreground">{selectedBooking.userName || selectedBooking.user_id}</span>
              </SheetDescription>
            </SheetHeader>

            {/* Stepper Display */}
            <div className="p-4 rounded-xl surface border border-border/80">
              <BookingLifecycle
                status={selectedBooking.status}
                createdAt={selectedBooking.created_at}
                decidedAt={selectedBooking.decided_at}
                decisionNote={selectedBooking.decision_note}
              />
            </div>

            {/* Timing & Purpose */}
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 surface p-3.5 rounded-xl border border-border/80">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Start Window</span>
                  <span className="font-mono font-semibold">{new Date(selectedBooking.startTime || selectedBooking.start_at || '').toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">End Window</span>
                  <span className="font-mono font-semibold">{new Date(selectedBooking.endTime || selectedBooking.end_at || '').toLocaleString()}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-border/60">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Stated Purpose</span>
                  <p className="text-foreground leading-relaxed mt-0.5">{selectedBooking.purpose || 'No purpose stated.'}</p>
                </div>
                {selectedBooking.supervisor_name && (
                  <div className="col-span-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Supervisor</span>
                    <span className="font-semibold text-foreground">{selectedBooking.supervisor_name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Borrower's Past History with this Resource */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4 text-primary" />
                <span>Borrower History with this Equipment</span>
              </span>

              {historyLoading ? (
                <div className="p-4 text-center text-xs text-muted-foreground">Loading member track record...</div>
              ) : memberHistory.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground surface rounded-xl border border-border/60">
                  First time booking this piece of equipment.
                </div>
              ) : (
                <div className="divide-y divide-border/60 surface rounded-xl border border-border/60 overflow-hidden text-xs">
                  {memberHistory.map((h: any) => (
                    <div key={h.id} className="p-3 flex items-center justify-between">
                      <div>
                        <span className="font-mono text-muted-foreground block text-[11px]">
                          {new Date(h.start_at).toLocaleDateString()}
                        </span>
                        {h.decision_note && (
                          <span className="text-[10px] text-muted-foreground italic truncate block max-w-xs">
                            &ldquo;{h.decision_note}&rdquo;
                          </span>
                        )}
                      </div>
                      <StatusBadge status={h.status} showDot={false} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sheet Actions */}
            <div className="pt-4 border-t border-border/60 flex items-center justify-end gap-2">
              {selectedBooking.status === 'pending' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDecisionModal({ booking: selectedBooking, approve: false });
                      setDecisionNote('');
                    }}
                    className="text-xs text-destructive hover:text-destructive border-destructive/30"
                  >
                    Decline Request
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setDecisionModal({ booking: selectedBooking, approve: true });
                      setDecisionNote('');
                    }}
                    className="text-xs font-semibold shadow-xs"
                  >
                    Approve Reservation
                  </Button>
                </>
              )}
              {selectedBooking.status === 'approved' && Date.now() < new Date(selectedBooking.startTime || selectedBooking.start_at || '').getTime() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRevokeBooking(selectedBooking);
                    setRevokeNote('');
                  }}
                  className="text-xs text-destructive hover:text-destructive border-destructive/30"
                >
                  Revoke Approval
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Decision Dialog (Approve / Reject)                                  */}
      {/* ------------------------------------------------------------------- */}
      {decisionModal && (
        <Dialog open={!!decisionModal} onOpenChange={(open) => !open && setDecisionModal(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {decisionModal.approve ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <span>Approve Reservation</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-destructive" />
                    <span>Decline Reservation</span>
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {decisionModal.approve
                  ? 'Confirm that the borrower is eligible and the equipment is operational.'
                  : 'Specify an optional administrative explanation for the borrower.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Decision Note {decisionModal.approve ? '(Optional)' : '(Recommended)'}
                </label>
                <Textarea
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value.slice(0, 500))}
                  placeholder={
                    decisionModal.approve
                      ? 'e.g. Approved. Please bring your safety glasses.'
                      : 'e.g. Machine scheduled for routine laser calibration during this window.'
                  }
                  className="text-xs"
                  rows={3}
                />
                <span className="text-[10px] text-muted-foreground text-right block">
                  {decisionNote.length} / 500 characters
                </span>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDecisionModal(null)}
                disabled={isSubmittingDecision}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmDecision}
                disabled={isSubmittingDecision}
                className={
                  decisionModal.approve
                    ? 'font-semibold shadow-xs'
                    : 'bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold'
                }
              >
                {isSubmittingDecision ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Saving Decision...
                  </>
                ) : decisionModal.approve ? (
                  'Confirm Approval'
                ) : (
                  'Decline Reservation'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Revocation AlertDialog                                              */}
      {/* ------------------------------------------------------------------- */}
      {revokeBooking && (
        <AlertDialog open={!!revokeBooking} onOpenChange={(open) => !open && setRevokeBooking(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <span>Revoke Approved Reservation?</span>
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs leading-relaxed space-y-2">
                <p>
                  This will cancel the borrower&apos;s approved reservation and immediately offer the released slot to matching waitlist entries in FIFO order.
                </p>
                <div className="space-y-1 pt-2">
                  <label className="text-xs font-semibold text-foreground block">
                    Cancellation Reason (Sent to borrower)
                  </label>
                  <Textarea
                    value={revokeNote}
                    onChange={(e) => setRevokeNote(e.target.value.slice(0, 500))}
                    placeholder="e.g. Emergency facility maintenance required."
                    className="text-xs text-foreground"
                    rows={2}
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isRevoking}>Keep Approved</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmRevocation}
                disabled={isRevoking}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold text-xs"
              >
                {isRevoking ? 'Revoking...' : 'Revoke & Notify Waitlist'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

export default BookingRequests;
