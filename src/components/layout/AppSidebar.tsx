import {
  LayoutDashboard,
  Boxes,
  Compass,
  FileCheck2,
  Share2,
  Sparkles,
  SlidersHorizontal,
  GraduationCap,
  Building2,
  Layers,
} from 'lucide-react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '@/providers/AuthProvider';
import { Sidebar, useSidebar } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export function AppSidebar() {
  const { role, user } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const isInstitution = role === 'institution';

  const navItems = isInstitution
    ? [
        {
          label: 'Institution Overview',
          to: '/app/institution',
          icon: LayoutDashboard,
          badge: 'Live',
        },
        {
          label: 'Resource Management',
          to: '/app/institution/resources',
          icon: Boxes,
          badge: '47',
        },
        {
          label: 'Campus Discovery',
          to: '/app/discover',
          icon: Compass,
        },
        {
          label: 'Chain of Custody',
          to: '/app/bookings/bk-2024-001',
          icon: FileCheck2,
          badge: 'Active',
        },
      ]
    : [
        {
          label: 'Member Dashboard',
          to: '/app/user',
          icon: LayoutDashboard,
        },
        {
          label: 'My Bookings',
          to: '/app/bookings',
          icon: FileCheck2,
          badge: '2',
        },
        {
          label: 'Discover & Reserve',
          to: '/app/discover',
          icon: Compass,
          badge: 'New',
        },
      ];

  return (
    <Sidebar className="flex flex-col h-full bg-card/95 border-r border-border">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border/80">
        <Link
          to="/"
          onClick={handleNavClick}
          className="flex items-center gap-2.5 font-bold tracking-tight text-foreground transition-opacity hover:opacity-90"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20">
            <Share2 className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-extrabold tracking-tight leading-none bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              EquipSync
            </span>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
              Equipment Sharing
            </span>
          </div>
        </Link>
      </div>

      {/* Role Pill Banner */}
      <div className="px-4 py-3">
        <div
          className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium border ${
            isInstitution
              ? 'bg-primary/5 border-primary/20 text-primary'
              : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {isInstitution ? (
              <Building2 className="h-3.5 w-3.5" />
            ) : (
              <GraduationCap className="h-3.5 w-3.5" />
            )}
            <span className="capitalize font-semibold">{role} Workspace</span>
          </div>
          <Badge
            variant="outline"
            className="text-[9px] py-0 px-1 border-current opacity-80"
          >
            Live
          </Badge>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
        <div>
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Platform Navigation
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/app/institution' || item.to === '/app/user'}
                  onClick={handleNavClick}
                  className={({ isActive }) =>
                    `flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3">
                        <Icon
                          className={`h-4 w-4 ${
                            isActive ? 'text-primary-foreground' : 'text-muted-foreground'
                          }`}
                        />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isActive
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : 'bg-secondary text-secondary-foreground'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div>
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Quick Links
          </p>
          <nav className="space-y-1">
            <Link
              to="/"
              onClick={handleNavClick}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>Public Portal (Home)</span>
            </Link>
            <Link
              to="/app/discover"
              onClick={handleNavClick}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Layers className="h-4 w-4 text-sky-500" />
              <span>Explore Catalog</span>
            </Link>
          </nav>
        </div>
      </div>

      <Separator />

      {/* User Footer Summary */}
      <div className="p-4 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-foreground">
            {user.name[0]}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-semibold text-foreground truncate">
              {user.name}
            </span>
            <span className="text-[11px] text-muted-foreground truncate">
              {user.department}
            </span>
          </div>
        </div>
      </div>
    </Sidebar>
  );
}
