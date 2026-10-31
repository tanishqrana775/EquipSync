/**
 * src/components/layout/AppSidebar.tsx
 * EquipSync – Responsive collateral sidebar with icon rail collapsed mode,
 * Help Center and Account Settings dialogs, and instant tooltips.
 */

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Boxes,
  Compass,
  FileCheck2,
  Share2,
  GraduationCap,
  Building2,
  LifeBuoy,
  Settings,
  KeyRound,
  LogOut,
  Scale,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  Globe,
  ClipboardList,
} from 'lucide-react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '@/providers/AuthProvider';
import { useInstitutionStats } from '@/hooks/useInstitutionStats';
import { Sidebar, useSidebar } from '@/components/ui/sidebar';
import { LiveBadge } from '@/components/shared/LiveBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PasswordRecoveryWizard } from '@/features/auth/PasswordRecoveryWizard';
import '@/styles/sidebar.css';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { sendPasswordReset } from '@/lib/auth';
import { toastError } from '@/lib/errors';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface NavItemDef {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export function AppSidebar() {
  const { role, user, profile, institutionName, isVerified, signOut } = useAuth();
  const { isMobile, setOpenMobile, open } = useSidebar();

  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);
  const isCollapsed = !isMobile && !open;

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };


  const isInstitution = role === 'institution';
  const { stats } = useInstitutionStats();

  const navItems: NavItemDef[] = isInstitution
    ? [
        {
          label: 'Organization Overview',
          to: '/app/institution',
          icon: LayoutDashboard,
        },
        {
          label: 'Request queue',
          to: '/app/institution/requests',
          icon: ClipboardList,
          badge: stats?.pendingApprovals > 0 ? String(stats.pendingApprovals) : undefined,
        },
        {
          label: 'Resource Management',
          to: '/app/institution/resources',
          icon: Boxes,
        },
        {
          label: 'Equipment Catalogue',
          to: '/app/discover',
          icon: Compass,
        },
        {
          label: 'Chain of Custody',
          to: '/app/custody',
          icon: FileCheck2,
          badge: 'Audit',
        },
        {
          label: 'Custody Disputes',
          to: '/app/institution/disputes',
          icon: Scale,
          badge: 'Review',
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
        },
        {
          label: 'Chain of Custody',
          to: '/app/custody',
          icon: ShieldCheck,
        },
        {
          label: 'Discover & Reserve',
          to: '/app/discover',
          icon: Compass,
        },
      ];

  return (
    <>
      <Sidebar
        collapsible="icon"
        className={cn(
          'flex flex-col h-full bg-card/95 border-r border-border transition-all duration-300',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Brand Header */}
        <div
          className={cn(
            'flex items-center border-b border-border/80 transition-all',
            isCollapsed ? 'justify-center p-3 h-16' : 'gap-3 px-5 py-5'
          )}
        >
          <Link
            to="/"
            onClick={handleNavClick}
            className={cn(
              'flex items-center font-bold tracking-tight text-foreground transition-opacity hover:opacity-90',
              isCollapsed ? 'justify-center' : 'gap-2.5'
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20">
              <Share2 className="h-5 w-5" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-base font-extrabold tracking-tight leading-none bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent truncate">
                  EquipSync
                </span>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5 truncate">
                  Equipment Sharing
                </span>
              </div>
            )}
          </Link>
        </div>

        {/* Role Pill Banner */}
        <div className={cn('transition-all', isCollapsed ? 'p-2 text-center' : 'px-4 py-3')}>
          <div
            className={cn(
              'flex items-center rounded-xl text-xs font-medium',
              isCollapsed ? 'justify-center h-10 w-10 mx-auto' : 'border justify-between px-3 py-2',
              isInstitution
                ? 'bg-primary/5 border-primary/20 text-primary'
                : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
            )}
          >
            <div className={cn('flex items-center min-w-0', isCollapsed ? 'justify-center' : 'gap-2')}>
              {isInstitution ? (
                <Building2 className="h-4 w-4 shrink-0 text-current" />
              ) : (
                <GraduationCap className="h-4 w-4 shrink-0 text-current" />
              )}
              {!isCollapsed && (
                <span className="capitalize font-semibold truncate min-w-0">
                  {role === 'institution' ? 'Organization' : 'Member'} Workspace
                </span>
              )}
            </div>
            {!isCollapsed && <LiveBadge className="ml-2 shrink-0" />}
          </div>
        </div>
        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
          <div>
            {!isCollapsed && (
              <div className="flex items-center justify-between px-3 mb-2 gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate min-w-0">
                  Platform Navigation
                </p>
              </div>
            )}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const linkContent = (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/app/institution' || item.to === '/app/user'}
                    onClick={handleNavClick}
                    className={({ isActive }) =>
                      cn(
                        'relative flex items-center rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        isCollapsed ? 'justify-center h-10 w-10 mx-auto px-0' : 'justify-between px-3 py-2.5',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className={cn('flex items-center gap-3', isCollapsed ? 'justify-center w-full h-full' : '')}>
                          <Icon
                            className={cn(
                              'h-4 w-4 shrink-0 text-current transition-colors'
                            )}
                          />
                          {!isCollapsed && <span className="truncate">{item.label}</span>}
                        </div>
                        {!isCollapsed && item.badge && (
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0',
                              isActive
                                ? 'bg-primary-foreground/20 text-primary-foreground'
                                : 'bg-secondary text-secondary-foreground'
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                        {isCollapsed && item.badge && (
                          <span
                            className={cn(
                              'absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full',
                              isActive ? 'bg-primary-foreground ring-1 ring-primary' : 'bg-primary'
                            )}
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                );

                if (isCollapsed) {
                  return (
                    <Tooltip key={item.to}>
                      <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                      <TooltipContent side="right" className="font-semibold text-xs">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return linkContent;
              })}
            </nav>
          </div>

          {/* Footer Navigation Group: Help Center & Account Settings */}
          <div className="pt-2 border-t border-border/40">
            {!isCollapsed && (
              <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 truncate">
                Preferences & Support
              </p>
            )}
            <nav className="space-y-1">
              {isCollapsed ? (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setHelpOpen(true)}
                        className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <LifeBuoy className="h-4 w-4" />
                        <span className="sr-only">Help Center</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-semibold text-xs">
                      Help Center
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setSettingsOpen(true)}
                        className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <Settings className="h-4 w-4" />
                        <span className="sr-only">Account Settings</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-semibold text-xs">
                      Account Settings
                    </TooltipContent>
                  </Tooltip>

                  {isInstitution && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <NavLink
                          to="/app/institution/settings"
                          onClick={handleNavClick}
                          className={({ isActive }) =>
                            cn(
                              'flex h-10 w-10 mx-auto items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors',
                              isActive && 'bg-primary text-primary-foreground shadow-xs'
                            )
                          }
                        >
                          <Globe className="h-4 w-4 text-current" />
                          <span className="sr-only">Organization settings</span>
                        </NavLink>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="font-semibold text-xs">
                        Organization settings
                      </TooltipContent>
                    </Tooltip>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setHelpOpen(true)}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors font-medium text-left"
                  >
                    <LifeBuoy className="h-4 w-4 text-sky-500 shrink-0" />
                    <span>Help Center</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors font-medium text-left"
                  >
                    <Settings className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>Account Settings</span>
                  </button>

                  {isInstitution && (
                    <NavLink
                      to="/app/institution/settings"
                      onClick={handleNavClick}
                      className={({ isActive }) =>
                        cn(
                          'w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors font-medium text-left',
                          isActive && 'bg-primary text-primary-foreground shadow-xs font-semibold'
                        )
                      }
                    >
                      <Globe className="h-4 w-4 text-current shrink-0" />
                      <span>Organization settings</span>
                    </NavLink>
                  )}
                </>
              )}
            </nav>
          </div>
        </div>

        <Separator />

        {/* User Footer Summary with collapsed tooltip */}
        <div className={cn('bg-muted/20 transition-all', isCollapsed ? 'p-2 text-center' : 'p-4')}>
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="h-9 w-9 mx-auto rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-foreground hover:ring-2 hover:ring-primary/30 transition-all"
                >
                  {user.name ? user.name[0].toUpperCase() : 'U'}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                <span className="font-bold block">{user.name}</span>
                <span className="text-muted-foreground text-[10px]">{user.department}</span>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                {user.name ? user.name[0].toUpperCase() : 'U'}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-semibold text-foreground truncate">{user.name}</span>
                <span className="text-[11px] text-muted-foreground truncate">{user.department}</span>
              </div>
            </div>
          )}
        </div>
      </Sidebar>

      {/* Help Center Dialog */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-lg space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5 text-sky-500" />
              <DialogTitle className="text-lg font-bold text-foreground">
                Help & Platform Guidance
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Key operational instructions for equipment reservations and handovers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs text-foreground divide-y divide-border/50">
            <div className="space-y-1">
              <h4 className="font-bold flex items-center gap-1.5 text-primary">
                <CheckCircle2 className="h-4 w-4" /> How to book equipment
              </h4>
              <p className="text-muted-foreground leading-relaxed pl-5">
                Navigate to Discover, select your desired gear or space, choose a reservation date and window, and submit. If a slot is already taken, you can join the priority waitlist to be automatically offered the slot if it is released early.
              </p>
            </div>

            <div className="space-y-1 pt-3">
              <h4 className="font-bold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <FileCheck2 className="h-4 w-4" /> How to check out and return
              </h4>
              <p className="text-muted-foreground leading-relaxed pl-5">
                When your reservation is approved, visit the locker or custody desk and present your verification code. Upload multi-angle condition photos to complete the digital check-out. Upon return, submit check-in condition photos and verify all accessories for inspection.
              </p>
            </div>

            <div className="space-y-1 pt-3">
              <h4 className="font-bold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <HelpCircle className="h-4 w-4" /> Contact your organization administrator
              </h4>
              <p className="text-muted-foreground leading-relaxed pl-5">
                Need induction safety qualifications, special equipment supervision, or account verification? Please contact your organization's facility administrator directly.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium italic">Full documentation is coming soon</span>
            <Button size="sm" variant="outline" onClick={() => setHelpOpen(false)}>
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Account Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <DialogTitle className="text-lg font-bold text-foreground">
                Account Settings
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              View your authenticated profile and security details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-xl border border-border/80 bg-muted/30 p-4 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-border/50">
              <span className="text-muted-foreground">Full Name</span>
              <span className="font-semibold text-foreground">{user.name}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/50">
              <span className="text-muted-foreground">Email Address</span>
              <span className="font-semibold text-foreground">{user.email || 'Not provided'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/50">
              <span className="text-muted-foreground">Role</span>
              <span className="font-semibold text-foreground capitalize">
                {role === 'institution' ? 'Organization Administrator' : 'Member'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/50">
              <span className="text-muted-foreground">Organization</span>
              <span className="font-semibold text-foreground">
                {institutionName || user.department || 'Not affiliated'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Verification Status</span>
              <div className="flex items-center gap-1.5">
                <Badge
                  variant={isVerified ? 'default' : user.verificationStatus === 'rejected' ? 'destructive' : 'secondary'}
                  className="text-[10px] font-bold"
                >
                  {isVerified
                    ? user.verificationMethod === 'domain'
                      ? 'Verified (Domain)'
                      : 'Verified'
                    : user.verificationStatus === 'rejected'
                    ? 'Declined'
                    : 'Pending Verification'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!user.email}
              onClick={() => {
                setSettingsOpen(false);
                setChangePasswordDialogOpen(true);
              }}
              className="w-full sm:w-auto gap-1.5 text-xs font-semibold"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Change password</span>
            </Button>

            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setSettingsOpen(false);
                void signOut();
              }}
              className="w-full sm:w-auto gap-1.5 text-xs font-semibold"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog hosting PasswordRecoveryWizard in dialog mode */}
      <Dialog open={changePasswordDialogOpen} onOpenChange={setChangePasswordDialogOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-border/80">
          <PasswordRecoveryWizard
            mode="dialog"
            initialEmail={user.email}
            onCancel={() => setChangePasswordDialogOpen(false)}
            onSuccess={() => setChangePasswordDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
