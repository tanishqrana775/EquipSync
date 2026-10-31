/**
 * src/features/landing/WhatIsEquipSync.tsx
 * EquipSync – "What is EquipSync?" introductory 3-step explanation section.
 */

import React from 'react';
import { ListPlus, CheckCheck, QrCode } from 'lucide-react';
import { useReveal } from './useReveal';

export function WhatIsEquipSync() {
  const revealRef = useReveal<HTMLDivElement>();

  const steps = [
    {
      num: '01',
      icon: ListPlus,
      title: 'List what you own',
      desc: 'Add equipment, instruments, and spaces. Define custom eligibility rules, booking durations, and required training qualifications.',
    },
    {
      num: '02',
      icon: CheckCheck,
      title: 'Approve with confidence',
      desc: 'Verified members request slots within your configured availability windows. Automatic eligibility validation guarantees only certified borrowers book.',
    },
    {
      num: '03',
      icon: QrCode,
      title: 'Hand over with proof',
      desc: 'Verify handover with digital passcodes, require multi-angle timestamped condition photos on checkout and return, and inspect with an immutable audit log.',
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
            EquipSync is a trusted equipment and space sharing platform. It bridges the gap between idle inventory in departments, makerspaces, or tool cribs and the members who need them for projects, research, or commercial work.
          </p>
        </div>

        {/* 3 Step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.num}
                className="surface p-6 sm:p-7 rounded-2xl border border-border/80 shadow-sm hover:border-primary/40 hover:shadow-md transition-all space-y-4 relative group"
              >
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-2xl font-black text-muted-foreground/30 font-mono">
                    {s.num}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-bold text-foreground">
                    {s.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
