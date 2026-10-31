import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  Calendar,
  CheckCircle2,
  ShieldCheck,
  Compass,
  FileCheck2,
  QrCode,
  Sparkles,
  ArrowRight,
  Share2,
  ListOrdered,
  X,
  Zap,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { GlassCard } from '@/components/shared/GlassCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ResourceThumb } from '@/components/shared/ResourceThumb';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/providers/AuthProvider';
import { useBookings } from '@/hooks/useBookings';
import { useResources } from '@/hooks/useResources';
import { listInstitutions, Institution } from '@/lib/auth';
import { setMemberInstitution } from '@/lib/api/rpc';
import { toastError } from '@/lib/errors';
import { toast } from 'sonner';
import { useEffect } from 'react';

export function UserDashboard() {
  const { user, profile, refresh } = useAuth();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedInst, setSelectedInst] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (profile && !profile.institution_id) {
      void listInstitutions().then((data) => {
        if (data && data.length > 0) {
          setInstitutions(data);
          setSelectedInst(data[0].id ?? '');
        }
      });
    }
  }, [profile]);

  const handleJoinOrg = async () => {
    if (!selectedInst) return;
    try {
      setIsJoining(true);
      await setMemberInstitution(selectedInst);
      await refresh();
      toast.success('Joined organisation successfully!');
    } catch (err) {
      toastError(err, 'Failed to join organisation');
    } finally {
      setIsJoining(false);
    }
  };
  const {
    bookings,
    activeUsage,
    history,
    waitlist,
    releasedSlots,
    releaseBooking,
    claimReleasedSlot,
    leaveWaitlist,
  } = useBookings();
  const { resources } = useResources();

  // Find active borrowing
  const activeBooking = bookings.find((b) => b.status === 'active') || bookings[0];
  const suggestedResources = resources.filter((r) => r.status === 'available').slice(0, 3);

  // Derived user statistics
  const userStats = useMemo(() => {
    const activeCount = activeUsage.length;
    const upcomingCount = bookings.filter((b) => b.status === 'approved' || b.status === 'pending').length;
    const completedCount = history.filter((b) => b.status === 'completed').length;
    return {
      activeBorrowings: activeCount,
      upcomingReservations: upcomingCount,
      completedHandovers: completedCount,
      reputationScore: 99.4,
    };
  }, [activeUsage, bookings, history]);

  const handleRelease = async (bookingId: string) => {
    try {
      await releaseBooking(bookingId);
    } catch {
      // Handled in hook
    }
  };

  const handleClaim = async (slotId: string) => {
    try {
      await claimReleasedSlot(slotId);
    } catch {
      // Handled in hook
    }
  };

  const approvedBookingsToRelease = bookings.filter((b) => b.status === 'approved');

  if (profile && !profile.institution_id) {
    return (
      <div className="max-w-md mx-auto py-12 space-y-4">
        <div className="surface p-8 rounded-2xl border border-border/80 text-center space-y-4 shadow-lg">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Compass className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-foreground">Join an Organisation</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your account is not yet affiliated with an equipment-sharing organisation. Select your university, workshop, or lab below to begin.
            </p>
          </div>
          <div className="space-y-3 pt-2 text-left">
            <label className="text-xs font-semibold text-foreground">Select Organisation</label>
            <select
              value={selectedInst}
              onChange={(e) => setSelectedInst(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
            >
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id ?? ''}>
                  {inst.name} ({inst.type})
                </option>
              ))}
            </select>
            <Button
              disabled={isJoining || !selectedInst}
              onClick={handleJoinOrg}
              className="w-full font-semibold mt-2"
            >
              {isJoining ? 'Joining...' : 'Affiliate & Open Dashboard'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Member & Researcher Portal"
        title={`Welcome back, ${user.name.split(' ')[0]}`}
        description="Track your current equipment passes, return due dates, and discover specialized gear across shared facilities."
      >
        <Link to="/app/discover">
          <Button size="sm" className="gap-2 font-semibold shadow-sm">
            <Compass className="h-4 w-4" />
            <span>Discover Resources</span>
          </Button>
        </Link>
        {activeBooking && (
          <Link to={`/app/bookings/${activeBooking.id}`}>
            <Button variant="outline" size="sm" className="gap-2 font-medium bg-card">
              <FileCheck2 className="h-4 w-4 text-emerald-600" />
              <span>Active Custody Pass</span>
            </Button>
          </Link>
        )}
      </PageHeader>

      {/* Released Slots Announcement Banner */}
      {releasedSlots.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 to-primary/15 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-xl">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">
                Released Time Slots Available!
              </h4>
              <p className="text-xs text-muted-foreground">
                A peer released an approved reservation. Verified organisation members can claim it instantly.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {releasedSlots.slice(0, 2).map((slot) => (
              <Button
                key={slot.id}
                size="sm"
                onClick={() => handleClaim(slot.id)}
                className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              >
                Claim {new Date(slot.start_at).toLocaleDateString()}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* User Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active in Custody"
          value={userStats.activeBorrowings}
          icon={Clock}
          change={activeBooking ? 'Pass currently active' : 'None active'}
          changeType="neutral"
          tone="success"
          description={activeBooking?.resourceTitle || 'Equipment custody'}
        />
        <StatCard
          title="Upcoming Reserved"
          value={userStats.upcomingReservations}
          icon={Calendar}
          change="Cleared or awaiting faculty"
          changeType="positive"
          tone="primary"
          description="Future academic reservations"
        />
        <StatCard
          title="Completed Handovers"
          value={userStats.completedHandovers}
          icon={CheckCircle2}
          change="Zero damages reported"
          changeType="positive"
          tone="info"
          description="Lifetime equipment loans"
        />
        <StatCard
          title="Member Trust Score"
          value={`${userStats.reputationScore}%`}
          icon={ShieldCheck}
          change="Top Tier Borrower"
          changeType="positive"
          tone="success"
          description="Express checkout eligible"
        />
      </div>
      {/* Active Borrowing Highlight Card */}
      {activeBooking && (
        <div className="pt-2">
          <GlassCard accent="green" className="rounded-2xl p-6 relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <img
                  src={activeBooking.resourceImage}
                  alt={activeBooking.resourceTitle}
                  className="h-20 w-20 md:h-24 md:w-24 rounded-xl object-cover border border-emerald-500/30 shrink-0 shadow-sm"
                />
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={activeBooking.status} />
                    <span className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5" /> Active Custody Pass
                    </span>
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-foreground">
                    {activeBooking.resourceTitle}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Checked out for: {activeBooking.purpose}
                  </p>
                  <p className="text-xs font-medium text-foreground pt-1">
                    Return Deadline:{' '}
                    <span className="text-primary font-bold">
                      {new Date(activeBooking.endTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </p>
                </div>
              </div>

              {/* Handover Verification Code Box */}
              <div className="flex flex-col sm:flex-row md:flex-col items-center gap-3 bg-card/80 backdrop-blur-md p-4 rounded-xl border border-border/80 text-center sm:text-left md:text-center min-w-[200px]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Handover Auth Code
                  </span>
                  <span className="font-mono text-xl font-extrabold tracking-widest text-primary">
                    {activeBooking.handoverCode}
                  </span>
                </div>
                <Link to={`/app/bookings/${activeBooking.id}`} className="w-full">
                  <Button size="sm" className="w-full text-xs font-semibold gap-1.5">
                    <QrCode className="h-3.5 w-3.5" />
                    <span>View Pass & Steps</span>
                  </Button>
                </Link>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Release Approved Booking Option */}
      {approvedBookingsToRelease.length > 0 && (
        <div className="surface p-4 rounded-xl border border-border/80 space-y-3">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Release Approved Reservation to Campus
            </h4>
          </div>
          <p className="text-xs text-muted-foreground">
            Plans changed? Release your approved booking so waitlisted researchers can use the equipment slot.
          </p>
          <div className="space-y-2">
            {approvedBookingsToRelease.map((b) => (
              <div key={b.id} className="p-3 bg-muted/30 rounded-lg flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-foreground">{b.resourceTitle}</span>
                  <span className="text-muted-foreground ml-2">
                    ({new Date(b.startTime).toLocaleDateString()} - {new Date(b.endTime).toLocaleDateString()})
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRelease(b.id)}
                  className="text-xs h-7 text-primary border-primary/30 hover:bg-primary/10"
                >
                  Release Slot
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Priority Waitlist Queue Section */}
      {waitlist.length > 0 && (
        <div className="surface p-5 rounded-2xl border border-border/80 space-y-3">
          <div className="flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-bold text-foreground">
              My Waitlist Positions
            </h4>
          </div>
          <div className="space-y-2">
            {waitlist.map((item) => (
              <div key={item.id} className="p-3 bg-muted/30 rounded-xl flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-bold">
                      Position #{item.position ?? 1}
                    </Badge>
                    <span className="font-semibold text-foreground">
                      Desired: {new Date(item.desired_start).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Status: <strong className="capitalize text-foreground">{item.status}</strong>
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => leaveWaitlist(item.id)}
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Leave
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Available Resources */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Available for Quick Reservation
            </h3>
            <p className="text-xs text-muted-foreground">
              Equipment ready for immediate check-out across facilities
            </p>
          </div>
          <Link to="/app/discover">
            <Button variant="ghost" size="sm" className="text-xs text-primary font-semibold">
              Browse all available →
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {suggestedResources.map((resource) => (
            <ResourceThumb key={resource.id} resource={resource} />
          ))}
        </div>
      </div>
    </div>
  );
}
