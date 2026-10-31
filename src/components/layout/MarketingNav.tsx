/**
 * src/components/layout/MarketingNav.tsx
 * EquipSync – Unified structured top navigation for Landing and AuthLayout.
 * Features glass styling (backdrop-blur-xl, bg-background/60), compacting shadow on scroll,
 * scroll-progress indicator on landing, mobile Sheet menu, and adaptive CTA buttons.
 */

import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Share2, ArrowRight, Menu, Home, Layers, Workflow, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './ThemeToggle';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useAuth } from '@/providers/AuthProvider';

export function MarketingNav() {
  const location = useLocation();
  const { isAuthenticated, role } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);

  const isLanding = location.pathname === '/';
  const isSignIn = location.pathname === '/login';
  const isRegister = location.pathname === '/register';

  const dashboardPath = role === 'institution' ? '/app/institution' : '/app/user';

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setScrolled(scrollY > 15);

      if (isLanding) {
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight > 0) {
          const progress = Math.min(100, Math.max(0, (scrollY / docHeight) * 100));
          setScrollProgress(progress);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLanding]);

  const navLinks = [
    { label: 'Home', href: isLanding ? '#' : '/', icon: Home },
    { label: 'Features', href: isLanding ? '#features' : '/#features', icon: Layers },
    { label: 'How it works', href: isLanding ? '#how-it-works' : '/#how-it-works', icon: Workflow },
    { label: 'FAQ', href: isLanding ? '#faq' : '/#faq', icon: HelpCircle },
  ];

  return (
    <header
      className={`sticky top-0 z-40 w-full transition-all duration-200 border-b border-border/50 backdrop-blur-xl bg-background/60 ${
        scrolled ? 'shadow-xs h-14' : 'h-16'
      }`}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs ring-2 ring-primary/20 shrink-0">
            <Share2 className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              EquipSync
            </span>
            <span className="hidden sm:inline text-[9px] text-muted-foreground uppercase font-semibold tracking-wider -mt-1">
              Equipment & Space Sharing
            </span>
          </div>
        </Link>

        {/* Desktop Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          {navLinks.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="hover:text-foreground transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />

          {/* Authenticated user button */}
          {isAuthenticated ? (
            <Link to={dashboardPath}>
              <Button size="sm" className="gap-1.5 shadow-xs font-semibold">
                <span>Open Dashboard</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              {/* Hide active page's own button */}
              {!isSignIn && (
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
              )}
              {!isRegister && (
                <Link to="/register">
                  <Button size="sm" className="gap-1.5 shadow-xs font-semibold">
                    <span>Get started</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              )}
            </div>
          )}

          {/* Mobile Sheet Menu */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="md:hidden"
                aria-label="Toggle navigation menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-card/95 backdrop-blur-xl p-0">
              <SheetHeader className="p-5 border-b border-border/80 text-left">
                <SheetTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                    <Share2 className="h-4 w-4" />
                  </div>
                  <span>EquipSync</span>
                </SheetTitle>
              </SheetHeader>

              <div className="p-4 space-y-4">
                <nav className="flex flex-col space-y-1">
                  {navLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <a
                        key={item.label}
                        href={item.href}
                        onClick={() => setSheetOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-primary" />
                        <span>{item.label}</span>
                      </a>
                    );
                  })}
                </nav>

                <div className="pt-3 border-t border-border/70 flex flex-col gap-2">
                  {isAuthenticated ? (
                    <Link to={dashboardPath} onClick={() => setSheetOpen(false)}>
                      <Button className="w-full gap-2 font-semibold">
                        <span>Launch Dashboard</span>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  ) : (
                    <>
                      {!isSignIn && (
                        <Link to="/login" onClick={() => setSheetOpen(false)}>
                          <Button variant="outline" className="w-full font-semibold">
                            Sign In
                          </Button>
                        </Link>
                      )}
                      {!isRegister && (
                        <Link to="/register" onClick={() => setSheetOpen(false)}>
                          <Button className="w-full gap-1.5 font-semibold">
                            <span>Get started</span>
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      )}
                    </>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Thin scroll-progress indicator on landing page */}
      {isLanding && (
        <div
          className="absolute bottom-0 left-0 h-[2px] bg-primary transition-all duration-75"
          style={{ width: `${scrollProgress}%` }}
        />
      )}
    </header>
  );
}

export default MarketingNav;
