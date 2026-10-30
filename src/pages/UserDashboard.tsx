import { Link } from 'react-router-dom';
import {
  Compass,
  FileCheck2,
  QrCode,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { GlassCard } from '@/components/shared/GlassCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ResourceThumb } from '@/components/shared/ResourceThumb';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/AuthProvider';
import { useBookings } from '@/hooks/useBookings';
import { useResources } from '@/hooks/useResources';
import { mockUserStats } from '@/lib/mock/activity';

export function UserDashboard() {
  const { user } = useAuth();
  const { bookings } = useBookings();
  const { resources } = useResources();

  // Find active borrowing
  const activeBooking = bookings.find((b) => b.status === 'active') || bookings[0];
  const suggestedResources = resources.filter((r) => r.status === 'available').slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Student & Researcher Portal"
        title={`Welcome back, ${user.name.split(' ')[0]}`}
        description="Track your current equipment passes, return due dates, and discover specialized gear across campus labs."
      >
        <Link to="/app/discover">
          <Button size="sm" className="gap-2 font-semibold shadow-sm">
            <Compass className="h-4 w-4" />
            <span>Discover Resources</span>
          </Button>
        </Link>
        <Link to="/app/bookings/bk-2024-001">
          <Button variant="outline" size="sm" className="gap-2 font-medium bg-card">
            <FileCheck2 className="h-4 w-4 text-emerald-600" />
            <span>Active Custody Pass</span>
          </Button>
        </Link>
      </PageHeader>

      {/* User Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active in Custody"
          value={mockUserStats.activeBorrowings}
          icon={Clock}
          change="Due in 2 days"
          changeType="neutral"
          tone="success"
          description="Sony FX3 Cinema Camera Kit"
        />
        <StatCard
          title="Upcoming Reserved"
          value={mockUserStats.upcomingReservations}
          icon={Calendar}
          change="Cleared by faculty"
          changeType="positive"
          tone="primary"
          description="MacBook Pro & Seminar Hall"
        />
        <StatCard
          title="Completed Handovers"
          value={mockUserStats.completedHandovers}
          icon={CheckCircle2}
          change="Zero damages reported"
          changeType="positive"
          tone="info"
          description="Lifetime loans on campus"
        />
        <StatCard
          title="Campus Trust Score"
          value={`${mockUserStats.reputationScore}%`}
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
                      November 3, 2024 at 18:00
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

      {/* Suggested Available Resources */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Available for Quick Reservation
            </h3>
            <p className="text-xs text-muted-foreground">
              Equipment ready for immediate check-out across campus lockers
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
