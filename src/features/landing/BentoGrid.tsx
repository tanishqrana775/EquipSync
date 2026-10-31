/**
 * src/features/landing/BentoGrid.tsx
 * EquipSync – 6-tile Bento Grid features section with mixed sizes and hover glow.
 */

import React, { useState } from 'react';
import {
  TrendingUp,
  RefreshCw,
  ShieldCheck,
  GraduationCap,
  Lock,
  History,
  Camera,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useReveal } from './useReveal';

export function BentoGrid() {
  const revealRef = useReveal<HTMLDivElement>();
  const [photoAngle, setPhotoAngle] = useState<'checkout' | 'checkin'>('checkout');

  return (
    <section id="features" className="py-16 md:py-24 border-b border-border/60 bg-muted/10">
      <div ref={revealRef} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Architecture Highlights
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Engineered for institutional accountability
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Every feature is purpose-built to eliminate equipment hoarding, resolve damage disputes before they start, and keep department data strictly isolated.
          </p>
        </div>

        {/* Bento Grid layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
          {/* Tile 1: Utilisation Intelligence (Col span 1) */}
          <div className="surface bento-card p-6 rounded-2xl border border-border/80 shadow-xs hover:border-primary/40 space-y-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-foreground">Utilisation Intelligence</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Automated 30-day usage analytics against configured availability windows. Proactively surface underutilised assets across all units.
            </p>
          </div>

          {/* Tile 2: Smart Reallocation (Col span 1) */}
          <div className="surface bento-card p-6 rounded-2xl border border-border/80 shadow-xs hover:border-emerald-500/40 space-y-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <RefreshCw className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-foreground">Smart Reallocation</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When a reservation is released early, waitlisted members automatically receive priority slots with instant in-app alerts.
            </p>
          </div>

          {/* Tile 3: Chain of Custody (Col span 2 - Largest Tile) */}
          <div className="surface bento-card md:col-span-2 p-6 rounded-2xl border border-border/80 shadow-xs hover:border-primary/40 space-y-4 bg-gradient-to-br from-card to-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Chain of Custody</h3>
                  <span className="text-[11px] text-muted-foreground">Multi-Angle Photo Handover Protocol</span>
                </div>
              </div>
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                Cryptographic Seal
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Requires multi-angle photos before check-out and upon return. SHA-256 hashed evidence and accessory checklists ensure indisputable condition records.
            </p>

            {/* Interactive Before/After Photo Mock */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground text-[11px]">Compare Photo Verification:</span>
                <div className="flex gap-1 bg-background p-0.5 rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => setPhotoAngle('checkout')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                      photoAngle === 'checkout'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Check-out View
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoAngle('checkin')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                      photoAngle === 'checkin'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Return Check-in View
                  </button>
                </div>
              </div>

              <div className="aspect-[21/9] w-full rounded-lg bg-card border border-border flex items-center justify-center relative overflow-hidden text-center p-3">
                <div className="space-y-1">
                  <Camera className="h-6 w-6 text-primary mx-auto opacity-70" />
                  <span className="text-xs font-bold text-foreground block">
                    {photoAngle === 'checkout' ? 'Front Angle: Pristine Condition' : 'Front Angle: Clean Return Inspected'}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground block">
                    {photoAngle === 'checkout' ? 'SHA-256: 7f83b165...e019a' : 'SHA-256: 9a204b71...c44d2'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tile 4: Eligibility & Training Checks (Col span 1) */}
          <div className="surface bento-card p-6 rounded-2xl border border-border/80 shadow-xs hover:border-amber-500/40 space-y-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <GraduationCap className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-foreground">Eligibility & Training</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Require specific qualification induction certifications or supervision for laser cutters, cleanrooms, and high-tier equipment.
            </p>
          </div>

          {/* Tile 5: Multi-Tenant Isolation (Col span 2 on md) */}
          <div className="surface bento-card md:col-span-2 p-6 rounded-2xl border border-border/80 shadow-xs hover:border-primary/40 space-y-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-foreground">Your Organisation's Data Stays Yours</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Strict multi-tenant architecture enforced by PostgreSQL Row-Level Security. Cross-tenant queries return zero rows, and private storage folders cannot be listed across organisations.
            </p>
          </div>

          {/* Tile 6: Audit Trail (Col span 1) */}
          <div className="surface bento-card p-6 rounded-2xl border border-border/80 shadow-xs hover:border-emerald-500/40 space-y-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <History className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-foreground">Append-Only Audit Trail</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every status shift, handover check, and administrative decision is irreversibly logged with timestamped actor metadata.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
