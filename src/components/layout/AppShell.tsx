import * as React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Topbar } from './Topbar';
import { MobileBottomNav } from './MobileBottomNav';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Boxes,
  Compass,
  FileCheck2,
  GraduationCap,
  Building2,
  Search,
} from 'lucide-react';
import { useResources } from '@/hooks/useResources';

export function AppShell() {
  const { resources } = useResources();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const navigate = useNavigate();

  // Keyboard shortcut listener for Cmd/Ctrl+K
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelectRoute = (path: string) => {
    setSearchOpen(false);
    navigate(path);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        {/* Responsive Sidebar (desktop sticky & mobile sheet) */}
        <AppSidebar />

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col min-w-0">
          <Topbar onSearchClick={() => setSearchOpen(true)} />

          <main className="flex-1 p-4 md:p-6 lg:p-8 pb-20 lg:pb-8 bg-gradient-to-b from-background to-muted/30 min-h-[calc(100vh-4rem)] animate-fade-in">
            <div className="mx-auto max-w-7xl">
              <Outlet />
            </div>
          </main>

          {/* Bottom navigation for mobile viewports */}
          <MobileBottomNav />
        </div>

        {/* Quick Command Palette */}
        <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
          <CommandInput placeholder="Type a resource, category, or page to jump..." />
          <CommandList>
            <CommandEmpty>No matching resources found.</CommandEmpty>
            <CommandGroup heading="Navigation">
              <CommandItem
                onSelect={() => handleSelectRoute('/app/institution')}
                className="cursor-pointer gap-2"
              >
                <Building2 className="h-4 w-4 text-primary" />
                <span>Organization Dashboard</span>
              </CommandItem>
              <CommandItem
                onSelect={() => handleSelectRoute('/app/user')}
                className="cursor-pointer gap-2"
              >
                <GraduationCap className="h-4 w-4 text-emerald-600" />
                <span>Student / User Dashboard</span>
              </CommandItem>
              <CommandItem
                onSelect={() => handleSelectRoute('/app/institution/resources')}
                className="cursor-pointer gap-2"
              >
                <Boxes className="h-4 w-4 text-blue-500" />
                <span>Resource Inventory</span>
              </CommandItem>
              <CommandItem
                onSelect={() => handleSelectRoute('/app/discover')}
                className="cursor-pointer gap-2"
              >
                <Compass className="h-4 w-4 text-indigo-500" />
                <span>Resource Discovery Catalog</span>
              </CommandItem>
              <CommandItem
                onSelect={() => handleSelectRoute('/app/bookings/bk-2024-001')}
                className="cursor-pointer gap-2"
              >
                <FileCheck2 className="h-4 w-4 text-amber-500" />
                <span>Active Chain of Custody</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Quick Resource Search">
              {resources.slice(0, 5).map((resource) => (
                <CommandItem
                  key={resource.id}
                  onSelect={() => handleSelectRoute('/app/discover')}
                  className="cursor-pointer gap-2"
                >
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">{resource.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {resource.category}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </div>
    </SidebarProvider>
  );
}
