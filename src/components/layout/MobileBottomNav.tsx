import { LayoutDashboard, Compass, Boxes, FileCheck2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/providers/AuthProvider';

export function MobileBottomNav() {
  const { role } = useAuth();
  const isInstitution = role === 'institution';

  const items = isInstitution
    ? [
        {
          label: 'Overview',
          to: '/app/institution',
          icon: LayoutDashboard,
        },
        {
          label: 'Resources',
          to: '/app/institution/resources',
          icon: Boxes,
        },
        {
          label: 'Discover',
          to: '/app/discover',
          icon: Compass,
        },
        {
          label: 'Custody',
          to: '/app/bookings/bk-2024-001',
          icon: FileCheck2,
        },
      ]
    : [
        {
          label: 'Dashboard',
          to: '/app/user',
          icon: LayoutDashboard,
        },
        {
          label: 'Discover',
          to: '/app/discover',
          icon: Compass,
        },
        {
          label: 'My Passes',
          to: '/app/bookings/bk-2024-001',
          icon: FileCheck2,
        },
      ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur-md px-3 py-2">
      <nav className="flex items-center justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/app/institution' || item.to === '/app/user'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-200 min-w-[64px] ${
                  isActive
                    ? 'text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`p-1 rounded-lg transition-colors ${
                      isActive ? 'bg-primary/10 text-primary' : ''
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-medium mt-0.5">
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
