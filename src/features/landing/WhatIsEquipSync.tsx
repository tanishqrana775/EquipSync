/**
 * src/features/landing/WhatIsEquipSync.tsx
 * EquipSync – 6-Step Workflow with Scroll Connector Line.
 * Explains full institutional custody cycle in British English.
 */

import React from 'react';
import {
  ListPlus,
  ShieldCheck,
  CalendarCheck,
  UserCheck,
  QrCode,
  FileCheck2,
} from 'lucide-react';
import { useReveal } from './useReveal';

export function WhatIsEquipSync() {
  const revealRef = useReveal<HTMLDivElement>();

  const steps = [
    {
      num: '01',
      icon: ListPlus,
      title: 'Register & Tag',
      desc: 'Catalog equipment and spaces with immutable EQP- tags and physical QR labels.',
    },
    {
      num: '02',
      icon: ShieldCheck,
      title: 'Define Eligibility',
      desc: 'Set mandatory qualification Inductions, lead times, and allowed borrower types.',
    },
    {
      num: '03',
      icon: CalendarCheck,
      title: 'Reserve Windows',
      desc: 'Certified members discover available gear and request booking slots within hours.',
    },
    {
      num: '04',
      icon: UserCheck,
      title: 'Approve & Release',
      desc: 'Managers approve reservations or let waitlisted members claim cancelled slots.',
    },
    {
      num: '05',
      icon: QrCode,
      title: 'Hand Over with Proof',
      desc: 'Check-out requires QR verification, accessory checks, and multi-angle SHA-256 photos.',
    },
    {
      num: '06',
      icon: FileCheck2,
      title: 'Inspect & Restock',
      desc: 'Verify return condition against checkout photos, log incidents if damaged, and restock.',
    },
  ];

  return (
    <section id="about" className="py-16 md:py-24 border-b border-border/60 bg-muted/15 scroll-mt-20">
      <div ref={revealRef} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            How It Works
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            What is EquipSync?
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            EquipSync is a trusted equipment and space sharing platform. It eliminates inventory hoarding across departments, workshops, and makerspaces with verified borrowers, photo-proof handovers, and tamper-evident audit trails.
          </p>
        </div>

        {/* 6 Step Grid with Connected Step Indicators */}
        <div className="relative">
          {/* Subtle connecting line for md and above */}
          <div
            aria-hidden="true"
            className="hidden md:block absolute top-1/2 left-4 right-4 h-0.5 bg-gradient-to-r from-primary/10 via-primary/30 to-primary/10 -translate-y-12 pointer-events-none"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {steps.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.num}
                  className="surface relative p-6 rounded-2xl border border-border/80 shadow-xs hover:border-primary/40 hover:shadow-md transition-all space-y-3 bg-card/85 backdrop-blur-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                      STEP {s.num}
                    </span>
                    <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-foreground">{s.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default WhatIsEquipSync;
