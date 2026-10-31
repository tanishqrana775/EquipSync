import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { BookingLifecycle } from '@/components/shared/BookingLifecycle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/shared/EmptyState';
import { useBookings } from '@/hooks/useBookings';
import { useAuth } from '@/providers/AuthProvider';
import { toastError } from '@/lib/errors';
import { toast } from 'sonner';
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

export function MyBookings() {
  const { bookings, cancelBooking, loading } = useBookings();
  const { isVerified, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchesSearch = b.resourceTitle.toLowerCase().includes(searchTerm.toLowerCase()) || b.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [bookings, searchTerm, statusFilter]);

  const stats = useMemo(() => ({
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    approved: bookings.filter(b => ['approved', 'active'].includes(b.status)).length,
    rejected: bookings.filter(b => b.status === 'cancelled').length,
    completed: bookings.filter(b => b.status === 'completed').length,
  }), [bookings]);

  const handleCancel = async (id: string) => {
    try {
      await cancelBooking(id);
    } catch {
      // Handled in hook
    }
  };
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My Bookings"
        title="Reservation Management"
        description="View your active custody passes, track reservation status, and manage upcoming asset returns."
      />

      {/* Pending / Rejected Member Alert Banner */}
      {!isVerified && (
        <div
          role="alert"
          className={`p-4 rounded-2xl border text-xs flex items-start gap-3 animate-fade-in ${
            user?.verificationStatus === 'rejected'
              ? 'bg-destructive/10 border-destructive/30 text-destructive'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
          }`}
        >
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold block text-sm">
              {user?.verificationStatus === 'rejected'
                ? 'Verification Declined'
                : 'Account Verification Pending'}
            </span>
            <p className="leading-relaxed">
              {user?.verificationStatus === 'rejected'
                ? "Your verification was declined. Contact your organization's admin."
                : "Your account is pending verification by your organization's admin. You can browse, but reservations are disabled until you're verified."}
            </p>
          </div>
        </div>
      )}
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: stats.total },
          { label: 'Pending', value: stats.pending },
          { label: 'Approved', value: stats.approved },
          { label: 'Rejected', value: stats.rejected },
          { label: 'Completed', value: stats.completed },
        ].map(stat => (
          <div key={stat.label} className="surface p-4 rounded-xl">
            <span className="text-xs text-muted-foreground">{stat.label}</span>
            <div className="text-2xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="surface p-4 rounded-2xl flex gap-3">
        <Input
          placeholder="Search bookings..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <select
          className="bg-background border rounded-lg px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* List */}
      {filteredBookings.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No bookings found"
          description="You don't have any bookings matching your filters."
          actionLabel="Explore Resources"
          onAction={() => window.location.href = '/app/discover'}
        />
      ) : (
        <div className="grid gap-4">
          {filteredBookings.map(b => (
            <div key={b.id} className="surface p-5 rounded-2xl border border-border/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/60">
                <div className="flex items-center gap-3.5">
                  <img src={b.resourceImage} alt={b.resourceTitle} className="h-12 w-12 rounded-xl object-cover border border-border shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm text-foreground">{b.resourceTitle}</h4>
                    <p className="text-xs text-muted-foreground font-mono">
                      {new Date(b.startTime).toLocaleString()} – {new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    status={b.status}
                    decisionNote={b.decision_note || (b as any).decisionNote}
                    cancelledByAdmin={b.status === 'cancelled' && !!(b.decision_note || (b as any).decidedBy)}
                  />
                </div>
              </div>

              {/* Stepper */}
              <BookingLifecycle
                status={b.status}
                createdAt={b.created_at || (b as any).createdAt}
                decidedAt={b.decided_at || (b as any).decidedAt}
                decisionNote={b.decision_note || (b as any).decisionNote}
              />

              <div className="pt-2 flex items-center justify-between border-t border-border/40">
                <span className="text-xs text-muted-foreground">
                  Ref ID: <span className="font-mono">{b.id.slice(0, 8)}</span>
                </span>
                <div className="flex items-center gap-2">
                  {(b.status === 'pending' || (b.status === 'approved' && Date.now() < new Date(b.startTime).getTime())) && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-xs text-destructive hover:bg-destructive/10 h-8">
                          Cancel Request
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel this reservation?</AlertDialogTitle>
                          <AlertDialogDescription className="text-xs">
                            Your reservation will be released and any matching waitlist requests will be notified.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Back</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleCancel(b.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-semibold">
                            Confirm Cancellation
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <Link to={`/app/bookings/${b.id}`}>
                    <Button variant="outline" size="sm" className="text-xs h-8">
                      View Custody Details
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
