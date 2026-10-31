/**
 * src/components/layout/AuthLayout.tsx
 * EquipSync – Authentication Pages Layout.
 * Uses unified MarketingNav, water ripple background, FloatingWidgets for parallax status cards,
 * and centered glass card content.
 */

import { Outlet } from 'react-router-dom';
import { MarketingNav } from './MarketingNav';
import { RippleBackground } from '@/components/effects/RippleBackground';
import { FloatingWidgets } from '@/components/effects/FloatingWidgets';
import '@/styles/entry.css';

export function AuthLayout() {
  return (
    <RippleBackground
      intensity="auth"
      className="relative isolate min-h-screen flex flex-col justify-between bg-primary/[0.02]"
    >
      {/* Unified Structured Top Navigation */}
      <MarketingNav />

      {/* Floating Status Badges at lg and above */}
      <FloatingWidgets />

      {/* Main Centered Content Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 w-full max-w-7xl mx-auto my-auto">
        <Outlet />
      </main>

      {/* Neutral British English Footer */}
      <footer className="relative z-10 p-4 text-center text-xs text-muted-foreground border-t border-border/30">
        EquipSync • Trusted Equipment & Space Sharing Platform
      </footer>
    </RippleBackground>
  );
}

export default AuthLayout;
