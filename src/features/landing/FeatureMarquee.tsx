/**
 * src/features/landing/FeatureMarquee.tsx
 * EquipSync – Dual-track auto-scrolling feature pills marquee.
 * Pure CSS keyframes from landing.css with pause on hover.
 */

import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  ListOrdered,
  Share2,
  QrCode,
  Camera,
  FileCheck2,
  AlertTriangle,
  History,
  TrendingUp,
  Bell,
} from 'lucide-react';
import '@/styles/landing.css';
import { useReveal } from './useReveal';

const ROW_1 = [
  { label: 'Eligibility checks', icon: ShieldCheck },
  { label: 'Approvals workflow', icon: CheckCircle2 },
  { label: 'Waiting lists queue', icon: ListOrdered },
  { label: 'Slot release & reallocation', icon: Share2 },
  { label: 'QR handover codes', icon: QrCode },
  { label: 'Before/after photo proof', icon: Camera },
];

const ROW_2 = [
  { label: 'Tamper-evident photos', icon: FileCheck2 },
  { label: 'Damage and dispute resolution', icon: AlertTriangle },
  { label: 'Audit trail logging', icon: History },
  { label: 'Utilisation insights', icon: TrendingUp },
  { label: 'In-app realtime notifications', icon: Bell },
];

export function FeatureMarquee() {
  const revealRef = useReveal<HTMLDivElement>();

  return (
    <section className="py-16 md:py-20 border-b border-border/60 overflow-hidden bg-background">
      <div ref={revealRef} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Platform Capabilities
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Everything you need for trusted sharing
          </h2>
        </div>

        <div className="space-y-4 pt-2">
          {/* Row 1: Leftward scroll */}
          <div className="marquee-container">
            <div className="marquee-track-left">
              {[...ROW_1, ...ROW_1].map((feat, idx) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={`r1-${idx}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border/80 bg-card text-xs font-semibold text-foreground shadow-xs hover:border-primary/40 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <span>{feat.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Row 2: Rightward scroll */}
          <div className="marquee-container">
            <div className="marquee-track-right">
              {[...ROW_2, ...ROW_2].map((feat, idx) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={`r2-${idx}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border/80 bg-card text-xs font-semibold text-foreground shadow-xs hover:border-emerald-500/40 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{feat.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
