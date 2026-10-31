/**
 * src/pages/Landing.tsx
 * EquipSync – Modern Landing Page with Ripple Effect, Bento Grid, and Dynamic Architecture.
 */

import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Building2,
  Compass,
} from 'lucide-react';
import { MarketingNav } from '@/components/layout/MarketingNav';
import { MarketingFooter } from '@/components/layout/MarketingFooter';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/shared/GlassCard';
import { RippleBackground } from '@/components/effects/RippleBackground';
import { FloatingMockCards } from '@/features/landing/FloatingMockCards';
import { WhatIsEquipSync } from '@/features/landing/WhatIsEquipSync';
import { FeatureMarquee } from '@/features/landing/FeatureMarquee';
import { BentoGrid } from '@/features/landing/BentoGrid';
import { useReveal } from '@/features/landing/useReveal';
import '@/styles/landing.css';

export function Landing() {
  const finalCtaRef = useReveal<HTMLDivElement>();

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-primary/20 selection:text-primary">
      <MarketingNav />

      {/* Hero Section with Interactive Water Ripple Effect */}
      <RippleBackground intensity="hero" className="relative isolate pt-14 pb-16 md:pt-24 md:pb-28 bg-primary/[0.02]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto space-y-6">
            {/* Eyebrow Pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-bold text-primary transition-all hover:bg-primary/10 tracking-wider uppercase">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>SHARE EQUIPMENT. KEEP TRUST.</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.12]">
              Idle equipment,{' '}
              <span className="bg-gradient-to-r from-primary via-blue-600 to-emerald-600 bg-clip-text text-transparent">
                meet the people who need it.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              EquipSync helps universities, workshops and shops lend out cameras, machines, labs and spaces, with verified borrowers, photo-proof handovers and no more 'who broke it?' arguments.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <Link to="/register" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto gap-2 font-bold shadow-md h-12 px-7">
                  <span>Get started</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#about" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 font-semibold bg-background/60 h-12 px-6">
                  <Compass className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>See how it works</span>
                </Button>
              </a>
            </div>

            {/* Trust and Feature Badges */}
            <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground font-medium">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Role-Gated Permissions
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Cryptographic Photo Proof
              </span>
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Multi-Tenant Isolation
              </span>
            </div>

            {/* Floating Illustrative Product Mock Cards */}
            <FloatingMockCards />
          </div>
        </div>
      </RippleBackground>

      {/* "What is EquipSync?" 3-Step Section */}
      <WhatIsEquipSync />

      {/* Dual-Track Feature Pills Marquee */}
      <FeatureMarquee />

      {/* 6-Tile Bento Grid Section */}
      <BentoGrid />

      {/* Final Action Band */}
      <section className="py-16 md:py-24 bg-background">
        <div ref={finalCtaRef} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <GlassCard accent="blue" className="p-8 sm:p-12 rounded-3xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>Ready for Deployment</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                  Start sharing equipment across your organisation today
                </h3>
                <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
                  Join verified universities, research labs, workshops, and makerspaces using EquipSync to eliminate inventory hoarding and protect high-value assets.
                </p>
              </div>

              <div className="shrink-0 flex flex-col sm:flex-row gap-3">
                <Link to="/register">
                  <Button size="lg" className="w-full sm:w-auto font-bold shadow-md px-6">
                    Create Organisation Account
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto font-semibold px-6">
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
