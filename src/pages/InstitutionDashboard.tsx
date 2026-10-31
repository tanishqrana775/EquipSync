import { Link } from 'react-router-dom';
import {
  Boxes,
  Clock,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  Plus,
  Compass,
  FileCheck2,
  CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { GlassCard } from '@/components/shared/GlassCard';
import { ActivityTimeline } from '@/components/shared/ActivityTimeline';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LiveBadge } from '@/components/shared/LiveBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useResources } from '@/hooks/useResources';
import { useBookings } from '@/hooks/useBookings';
import { useInstitutionStats } from '@/hooks/useInstitutionStats';
import { Check, X, UserCheck, Scale, Users } from 'lucide-react';
export function InstitutionDashboard() {
  const { resources, loading: resourcesLoading } = useResources();
  const { bookings, loading: bookingsLoading, decideBooking } = useBookings({ institutionWide: true });
  const { stats, pendingMembers, verifyMember, underutilised, loading: statsLoading } = useInstitutionStats();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administrative Overview"
        title="Organization Management"
        description="Monitor asset circulation, verify custody passes, and evaluate equipment utilization."
      >
        <Link to="/app/institution/resources">
          <Button size="sm" className="gap-2 font-semibold shadow-sm">
            <Plus className="h-4 w-4" />
            <span>Manage Inventory</span>
          </Button>
        </Link>
        <Link to="/app/discover">
          <Button variant="outline" size="sm" className="gap-2 font-medium bg-card">
            <Compass className="h-4 w-4 text-emerald-600" />
            <span>Equipment Catalog</span>
          </Button>
        </Link>
        <Link to="/app/institution/disputes">
          <Button variant="outline" size="sm" className="gap-2 font-medium bg-card text-destructive hover:bg-destructive/10">
            <Scale className="h-4 w-4 text-destructive" />
            <span>Disputes</span>
          </Button>
        </Link>
      </PageHeader>
      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Cataloged Assets"
          value={stats.totalResources}
          icon={Boxes}
          tone="primary"
          description="Distributed across facilities"
        />
        <StatCard
          title="Active Checkouts"
          value={stats.activeBookings}
          icon={Clock}
          change={`${stats.totalResources > 0 ? Math.round((stats.activeBookings / stats.totalResources) * 100) : 0}% of inventory`}
          changeType="neutral"
          tone="success"
          description="In verified member custody"
        />
        <StatCard
          title="Fleet Utilisation"
          value={`${stats.utilisationRate}%`}
          icon={TrendingUp}
          tone="info"
          description="Target efficiency > 70%"
        />
        <StatCard
          title="Pending Approvals"
          value={stats.pendingApprovals}
          icon={AlertTriangle}
          change={stats.pendingApprovals > 0 ? "Requires owner review" : "All reviewed"}
          changeType={stats.pendingApprovals > 0 ? "negative" : "neutral"}
          tone="warning"
          description="High-tier equipment requests"
        />
      </div>

      {/* Main Grid: Active Reservations & Live Custody Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* Active Reservations & Recent Requests */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">
                Recent Bookings
              </h3>
              <p className="text-xs text-muted-foreground">
                Live bookings scheduled across facilities
              </p>
            </div>
            <Link to="/app/institution/resources">
              <Button variant="ghost" size="sm" className="text-xs text-primary gap-1">
                <span>View all</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          <div className="space-y-3">
            {bookings.slice(0, 3).map((bk) => (
              <div
                key={bk.id}
                className="surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 surface-hover rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={bk.resourceImage}
                    alt={bk.resourceTitle}
                    className="h-12 w-12 rounded-lg object-cover border border-border shrink-0"
                  />
                  <div>
                    <h4 className="text-sm font-semibold text-foreground line-clamp-1">
                      {bk.resourceTitle}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Requested by <span className="font-medium text-foreground">{bk.userName}</span> • {bk.userDepartment}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-border/50">
                  <StatusBadge status={bk.status} />
                  {bk.status === 'pending' && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => decideBooking({ bookingId: bk.id, approve: false, note: 'Declined by administrator' })}
                        className="h-8 text-xs text-destructive hover:bg-destructive/10 px-2"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Reject</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => decideBooking({ bookingId: bk.id, approve: true, note: 'Approved by faculty' })}
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2.5"
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        <span>Approve</span>
                      </Button>
                    </div>
                  )}
                  <Link to={`/app/bookings/${bk.id}`}>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1 font-medium">
                      <FileCheck2 className="h-3.5 w-3.5 text-primary" />
                      <span>Custody</span>
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Member Verification Queue */}
        {pendingMembers.length > 0 && (
          <div className="surface p-5 rounded-2xl border border-border/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  Member Verification Queue ({pendingMembers.length})
                </h3>
              </div>
              <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-700 dark:text-amber-300">
                Action Required
              </Badge>
            </div>

            <div className="space-y-2.5">
              {pendingMembers.map((m) => (
                <div
                  key={m.id}
                  className="p-3.5 rounded-xl border border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {m.full_name || 'Member'}
                      </span>
                      {m.verification_method === 'domain' && (
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Verified automatically
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {m.user_type || 'member'}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      Member ID: {m.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => verifyMember(m.id, false)}
                      className="h-8 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      <span>Decline</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => verifyMember(m.id, true)}
                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      <span>Verify Member</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Custody Timeline & Quick Auditing */}
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">
                Activity Audit Feed
              </h3>
              <LiveBadge />
            </div>
            <p className="text-xs text-muted-foreground">
              Real-time checkout, return & inspection events
            </p>
          </div>

          <GlassCard accent="green" className="rounded-2xl p-5">
            <ActivityTimeline limit={4} />
            <div className="mt-4 pt-3 border-t border-border/60">
              <Link to="/app/bookings/bk-2024-001">
                <Button variant="ghost" size="sm" className="w-full text-xs font-semibold text-emerald-700 dark:text-emerald-300 gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Inspect Active Custody Chain</span>
                </Button>
              </Link>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
