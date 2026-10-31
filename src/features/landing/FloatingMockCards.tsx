/**
 * src/features/landing/FloatingMockCards.tsx
 * EquipSync – Illustrative product preview cards for the landing hero.
 * Contains no invented statistics or company names.
 */

import React from 'react';
import { ShieldCheck, CheckCircle2, Camera, QrCode, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function FloatingMockCards() {
  return (
    <div className="relative w-full max-w-4xl mx-auto mt-12 hidden md:grid grid-cols-2 gap-6 pointer-events-none select-none">
      {/* Illustrative Card 1: Verified Booking Request */}
      <div className="surface p-5 rounded-2xl border border-border/80 shadow-xl backdrop-blur-md animate-float-card space-y-3.5 bg-card/70">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Camera className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                Equipment Reservation
              </span>
              <h4 className="text-sm font-bold text-foreground">
                Mirrorless Cinema Kit
              </h4>
            </div>
          </div>
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
            Approved
          </Badge>
        </div>

        <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px]">Clearance Window</span>
            <span className="font-semibold text-foreground">09:00 – 17:00</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>Eligibility & Safety Certified</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
          <span className="flex items-center gap-1 font-mono">
            <QrCode className="h-3.5 w-3.5 text-primary" />
            <span>Passcode: RT-4082</span>
          </span>
          <span className="text-primary font-semibold">Ready for Handover</span>
        </div>
      </div>

      {/* Illustrative Card 2: Chain of Custody Proof */}
      <div className="surface p-5 rounded-2xl border border-border/80 shadow-xl backdrop-blur-md animate-float-card-delayed space-y-3.5 bg-card/70">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                Chain of Custody
              </span>
              <h4 className="text-sm font-bold text-foreground">
                Photo Handover Audit
              </h4>
            </div>
          </div>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
            Verified
          </Badge>
        </div>

        {/* Before / After Thumbnail Mock */}
        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div className="p-2 rounded-xl bg-muted/40 border border-border/50 space-y-1">
            <div className="aspect-video w-full rounded-lg bg-muted flex items-center justify-center border border-border/60">
              <Camera className="h-4 w-4 text-muted-foreground/60" />
            </div>
            <span className="text-[10px] font-semibold text-muted-foreground block">Check-out Angle</span>
          </div>
          <div className="p-2 rounded-xl bg-muted/40 border border-border/50 space-y-1">
            <div className="aspect-video w-full rounded-lg bg-muted flex items-center justify-center border border-border/60">
              <Camera className="h-4 w-4 text-emerald-600/60" />
            </div>
            <span className="text-[10px] font-semibold text-muted-foreground block">Check-in Angle</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <Sparkles className="h-3 w-3" />
            <span>Condition Match: Good</span>
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">SHA-256 Sealed</span>
        </div>
      </div>
    </div>
  );
}
