import { Search, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { RoleSwitcher } from './RoleSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { NotificationsPopover } from './NotificationsPopover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface TopbarProps {
  onSearchClick?: () => void;
}

export function Topbar({ onSearchClick }: TopbarProps) {
  const { user, role } = useAuth();

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-border/80 bg-background/85 px-4 md:px-6 backdrop-blur-md transition-all">
      <div className="flex items-center gap-3">
        <SidebarTrigger />

        {/* Global Search trigger */}
        <button
          onClick={onSearchClick}
          className="hidden sm:flex items-center gap-2.5 h-9 w-52 md:w-72 rounded-lg border border-input bg-card/60 px-3 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all duration-200 shadow-sm"
        >
          <Search className="h-4 w-4 text-muted-foreground/70" />
          <span className="text-xs truncate">Search resources, bookings...</span>
          <kbd className="pointer-events-none ml-auto hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground md:inline-block">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* Demo Role Switcher */}
        <RoleSwitcher />

        {/* Notifications */}
        <NotificationsPopover />

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 rounded-full p-0.5 hover:ring-2 hover:ring-primary/30 transition-all focus:outline-none ml-1">
              <Avatar className="h-8 w-8 ring-1 ring-border">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                  {user.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-2">
            <DropdownMenuLabel className="font-normal p-2">
              <div className="flex flex-col space-y-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold leading-none text-foreground">
                    {user.name}
                  </p>
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 fill-emerald-100 dark:fill-emerald-950" />
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
                <div className="pt-1.5 flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono uppercase">
                    {user.campusId}
                  </Badge>
                  <Badge
                    variant={role === 'institution' ? 'default' : 'success'}
                    className="text-[10px] py-0 px-1.5 capitalize font-medium"
                  >
                    {user.role}
                  </Badge>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-xs">
              Campus Department:
              <span className="font-semibold ml-1 truncate">{user.department}</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer text-xs">
              Joined: <span className="font-semibold ml-1">{user.joinedDate}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs text-muted-foreground">
              CampusShare Phase 1 Build • v0.1.0
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
