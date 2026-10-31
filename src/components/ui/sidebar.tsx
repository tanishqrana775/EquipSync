import * as React from 'react';
import { PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { TooltipProvider } from '@/components/ui/tooltip';

const SIDEBAR_STORAGE_KEY = 'equipsync_sidebar_open';

interface SidebarContextType {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean | ((value: boolean) => boolean)) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean | ((value: boolean) => boolean)) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
}
const SidebarContext = React.createContext<SidebarContextType | null>(null);

export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}

export const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }
>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange: setOpenProp,
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const [openState, setOpenState] = React.useState<boolean>(() => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
        if (saved !== null) {
          return saved === 'true';
        }
      }
      return defaultOpen;
    });
    const [openMobile, setOpenMobile] = React.useState(false);
    const [isMobile, setIsMobile] = React.useState(false);

    const open = openProp ?? openState;
    const setOpen = React.useCallback(
      (value: boolean | ((value: boolean) => boolean)) => {
        setOpenState((prev) => {
          const next = typeof value === 'function' ? value(prev) : value;
          if (setOpenProp) {
            setOpenProp(next);
          }
          if (typeof window !== 'undefined') {
            localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
          }
          return next;
        });
      },
      [setOpenProp]
    );

    React.useEffect(() => {
      const checkMobile = () => {
        setIsMobile(window.innerWidth < 1024);
      };
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const toggleSidebar = React.useCallback(() => {
      return isMobile
        ? setOpenMobile((prev) => !prev)
        : setOpen((prev) => !prev);
    }, [isMobile, setOpen, setOpenMobile]);

    React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (
          event.key === 'b' &&
          (event.metaKey || event.ctrlKey) &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          toggleSidebar();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleSidebar]);

    return (
      <SidebarContext.Provider
        value={{
          state: open ? 'expanded' : 'collapsed',
          open,
          setOpen,
          openMobile,
          setOpenMobile,
          isMobile,
          toggleSidebar,
        }}
      >
        <TooltipProvider delayDuration={0}>
          <div
            ref={ref}
            data-state={open ? 'expanded' : 'collapsed'}
            className={cn(
              'group/sidebar-wrapper flex min-h-screen w-full has-[[data-variant=inset]]:bg-sidebar',
              className
            )}
            style={style}
            {...props}
          >
            {children}
          </div>
        </TooltipProvider>
      </SidebarContext.Provider>
    );
  }
);
SidebarProvider.displayName = 'SidebarProvider';

export const SidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon-sm"
      className={cn('h-8 w-8 text-muted-foreground hover:text-foreground', className)}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <PanelLeft className="h-4 w-4" />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
});
SidebarTrigger.displayName = 'SidebarTrigger';

export const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    side?: 'left' | 'right';
    collapsible?: 'offcanvas' | 'icon' | 'none';
  }
>(({ side = 'left', collapsible = 'icon', className, children, ...props }, ref) => {
  const { isMobile, openMobile, setOpenMobile, open } = useSidebar();

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          side={side}
          className="w-72 p-0 bg-card border-r border-border text-foreground"
        >
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  const isCollapsed = collapsible === 'icon' && !open;

  return (
    <div
      ref={ref}
      data-state={open ? 'expanded' : 'collapsed'}
      data-collapsible={collapsible}
      className={cn(
        'hidden lg:flex flex-col h-screen sticky top-0 border-r border-border bg-card z-30 transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-16' : 'w-64',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
Sidebar.displayName = 'Sidebar';
