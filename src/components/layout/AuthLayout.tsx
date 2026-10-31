import { Outlet, Link } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { RippleBackground } from '@/components/effects/RippleBackground';

export function AuthLayout() {
  return (
    <RippleBackground intensity="auth" className="relative isolate min-h-screen flex flex-col justify-between bg-primary/[0.02]">
      {/* Auth Header */}
      <header className="flex items-center justify-between p-4 sm:p-6 max-w-7xl mx-auto w-full">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Share2 className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold text-foreground">EquipSync</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Main content container */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Outlet />
      </main>

      {/* Auth Footer */}
      <footer className="p-4 text-center text-xs text-muted-foreground">
        EquipSync • Trusted Equipment & Space Sharing Platform
      </footer>
    </RippleBackground>
  );
}
