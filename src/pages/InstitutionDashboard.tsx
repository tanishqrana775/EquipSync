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
import { Button } from '@/components/ui/button';
import { useResources } from '@/hooks/useResources';
import { useBookings } from '@/hooks/useBookings';
import { mockInstitutionStats } from '@/lib/mock/activity';

export function InstitutionDashboard() {
  const { resources, loading: resourcesLoading } = useResources();
  const { bookings, loading: bookingsLoading } = useBookings();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administrative Overview"
        title="Institution Management"
        description="Monitor campus asset circulation, verify custody passes, and evaluate department equipment utilisation."
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
            <span>Campus Catalog</span>
          </Button>
        </Link>
      </PageHeader>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Cataloged Assets"
          value={mockInstitutionStats.totalResources}
          icon={Boxes}
          change="+8 this quarter"
          changeType="positive"
          tone="primary"
          description="Distributed across 4 faculty hubs"
        />
        <StatCard
          title="Active Checkouts"
          value={mockInstitutionStats.activeBookings}
          icon={Clock}
          change="38% of total inventory"
          changeType="neutral"
          tone="success"
          description="In verified student & staff custody"
        />
        <StatCard
          title="Fleet Utilisation"
          value={`${mockInstitutionStats.utilisationRate}%`}
          icon={TrendingUp}
          change="+4.2% vs last term"
          changeType="positive"
          tone="info"
          description="Target efficiency > 70%"
        />
        <StatCard
          title="Pending Approvals"
          value={mockInstitutionStats.pendingApprovals}
          icon={AlertTriangle}
          change="Requires faculty review"
          changeType="neutral"
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
                Recent Campus Bookings
              </h3>
              <p className="text-xs text-muted-foreground">
                Live bookings scheduled across academic facilities
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

        {/* Live Custody Timeline & Quick Auditing */}
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Live Activity Audit
            </h3>
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
