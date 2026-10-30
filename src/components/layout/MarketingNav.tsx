import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Share2, ArrowRight, Menu, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './ThemeToggle';
import { RoleSwitcher } from './RoleSwitcher';
import { useAuth } from '@/providers/AuthProvider';

export function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { role } = useAuth();

  const dashboardPath =
    role === 'institution' ? '/app/institution' : '/app/user';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20">
            <Share2 className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              CampusShare
            </span>
            <span className="hidden sm:inline text-[9px] text-muted-foreground uppercase font-semibold tracking-wider -mt-1">
              Resource Sharing Platform
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
          <Link
            to="/app/discover"
            className="hover:text-foreground transition-colors"
          >
            Explore Catalog
          </Link>
          <a
            href="#features"
            className="hover:text-foreground transition-colors"
          >
            Capabilities
          </a>
          <a
            href="#architecture"
            className="hover:text-foreground transition-colors"
          >
            Design System
          </a>
          <Link
            to="/app/bookings/bk-2024-001"
            className="hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
            <span>Chain of Custody</span>
          </Link>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <RoleSwitcher />
          <ThemeToggle />

          <div className="hidden sm:flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link to={dashboardPath}>
              <Button size="sm" className="gap-1.5 shadow-sm font-semibold">
                Open App <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-b border-border bg-card px-4 pt-3 pb-6 space-y-4 animate-fade-in">
          <div className="flex flex-col space-y-2 text-sm font-medium">
            <Link
              to="/app/discover"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-accent text-foreground"
            >
              Explore Catalog
            </Link>
            <Link
              to="/app/bookings/bk-2024-001"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-accent text-foreground"
            >
              Chain of Custody
            </Link>
            <Link
              to={dashboardPath}
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2 rounded-lg bg-primary/10 text-primary font-semibold"
            >
              Launch Dashboard ({role})
            </Link>
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-accent text-muted-foreground"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-accent text-muted-foreground"
            >
              Create Account
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
