/**
 * src/features/landing/InteractivePreview.tsx
 * EquipSync – "See it in action" Tabbed Interactive Preview.
 * Illustrative mock panels for Owner, Member, and Custody flows.
 * British English, responsive tabs, zero layout shift.
 */

import { useState } from 'react';
import {
  ShieldCheck,
  Building2,
  User,
  FileCheck2,
  QrCode,
  Camera,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Boxes,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type PreviewRole = 'owner' | 'member' | 'custody';

export function InteractivePreview() {
  const [activeTab, setActiveTab] = useState<PreviewRole>('owner');

  return (
    <section id="how-it-works" className="py-16 md:py-24 border-b border-border/60 bg-muted/10 scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Interactive Experience
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            See it in action
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Experience how EquipSync unifies organization governance, certified borrowing, and cryptographic handovers into one friction-free workflow.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex justify-center">
          <div className="inline-flex items-center p-1.5 rounded-2xl bg-muted/70 border border-border/80 shadow-xs gap-1.5">
            <button
              onClick={() => setActiveTab('owner')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'owner'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Building2 className="h-4 w-4" />
              <span>Owner Oversight</span>
            </button>
            <button
              onClick={() => setActiveTab('member')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'member'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <User className="h-4 w-4" />
              <span>Member Experience</span>
            </button>
            <button
              onClick={() => setActiveTab('custody')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'custody'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileCheck2 className="h-4 w-4" />
              <span>Chain of Custody</span>
            </button>
          </div>
        </div>

        {/* Preview Container */}
        <div className="max-w-4xl mx-auto rounded-3xl border border-border/80 bg-card/80 backdrop-blur-xl shadow-xl overflow-hidden p-6 sm:p-8 transition-all">
          {/* TAB 1: OWNER */}
          {activeTab === 'owner' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border/60 gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Facility Management Hub</h3>
                    <p className="text-xs text-muted-foreground">Automated eligibility and asset governance</p>
                  </div>
                </div>
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 gap-1.5 self-start sm:self-auto text-xs py-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Tenant Isolation Active</span>
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Inventory Governance
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-foreground">100%</span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Unique Tagged</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Every physical asset receives a permanent scannable EQP- tag.</p>
                </div>

                <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Eligibility Gate
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-primary">Pre-Filtered</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Unverified members cannot book high-risk equipment.</p>
                </div>

                <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Retirement Protection
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-foreground">Audited</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Active loans block retirement; future waitlists cancel cleanly.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MEMBER */}
          {activeTab === 'member' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border/60 gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Member Reservation Portal</h3>
                    <p className="text-xs text-muted-foreground">Certified booking with zero friction</p>
                  </div>
                </div>
                <Badge variant="outline" className="border-primary/30 text-primary gap-1.5 self-start sm:self-auto text-xs py-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Verified Qualifications</span>
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Available Now</span>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px]">
                      Available
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-foreground block">Precision Optical Spectrometer</span>
                    <span className="text-xs text-muted-foreground font-mono">EQP-7K9M2W • Main Optics Lab</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span>Configured windows: Weekdays 09:00 – 18:00</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Active Custody Pass</span>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 text-[10px]">
                      In Custody
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-foreground block">Digital Return Passcode</span>
                    <span className="text-lg font-mono font-extrabold text-primary tracking-widest block">RT-8429</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Present to desk officer upon return inspection.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTODY */}
          {activeTab === 'custody' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border/60 gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <FileCheck2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Cryptographic Handover Verification</h3>
                    <p className="text-xs text-muted-foreground">Immutable multi-angle photo proof and SHA-256 audit</p>
                  </div>
                </div>
                <Badge variant="outline" className="border-blue-500/30 text-blue-600 dark:text-blue-400 gap-1.5 self-start sm:self-auto text-xs py-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Tamper Evident</span>
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {['Front View', 'Back View', 'Left Angle', 'Right Angle'].map((slot, idx) => (
                  <div key={slot} className="p-3 rounded-xl bg-muted/40 border border-border/70 text-center space-y-2">
                    <div className="h-14 rounded-lg bg-card/60 flex items-center justify-center border border-border/50">
                      <Camera className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <span className="text-xs font-semibold text-foreground block">{slot}</span>
                    <Badge variant="secondary" className="text-[9px] gap-1 py-0 px-1 font-mono">
                      <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                      <span>SHA-256</span>
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-primary" />
                  <span className="font-medium text-foreground">Physical Asset QR Verification:</span>
                  <span className="font-mono text-muted-foreground">MATCHED</span>
                </div>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Check-out Authorised
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default InteractivePreview;
