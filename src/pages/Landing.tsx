import { Link } from 'react-router-dom';
import {
  Share2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Laptop,
  Video,
  Microscope,
  Compass,
  Building2,
  Lock,
} from 'lucide-react';
import { MarketingNav } from '@/components/layout/MarketingNav';
import { MarketingFooter } from '@/components/layout/MarketingFooter';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/shared/GlassCard';
import { StatCard } from '@/components/shared/StatCard';
import { ResourceThumb } from '@/components/shared/ResourceThumb';
import { useResources } from '@/hooks/useResources';
import { useAuth } from '@/providers/AuthProvider';
import { getPublicStats, PublicStats } from '@/lib/api/rpc';
import { useEffect, useState } from 'react';

export function Landing() {
  const { role } = useAuth();
  const { resources } = useResources();
  const [publicStats, setPublicStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    void getPublicStats().then(setPublicStats);
  }, []);

  const demoTarget = role === 'institution' ? '/app/institution' : '/app/user';
  const previewResources = resources.slice(0, 3);

  return (
    <div className="min-h-screen page-bg flex flex-col justify-between selection:bg-primary/20 selection:text-primary">
      <MarketingNav />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto space-y-6">
            {/* Eyebrow Pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/10">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>EquipSync Platform • Production Multi-Tenant Platform</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.15]">
              Centralized Equipment & Space Sharing with{' '}
              <span className="bg-gradient-to-r from-primary via-blue-600 to-emerald-600 bg-clip-text text-transparent">
                Chain of Custody
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Eliminate equipment downtime, automate reservations, and trace shared assets from checkout to safe return with verified digital handovers.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <Link to={demoTarget} className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto gap-2 font-bold shadow-md">
                  <span>Get Started with EquipSync</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/app/discover" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 font-semibold bg-background/60">
                  <Compass className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Browse Available Gear</span>
                </Button>
              </Link>
            </div>

            {/* Trust and Feature Badges */}
            <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground font-medium">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Dual Role Access (Admin & Member)
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Cryptographic Handover Verification
              </span>
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Enterprise Row-Level Security
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Design System & Dashboard Metrics Highlight */}
      {/* Live System Stats Highlight */}
      {publicStats && (publicStats.institutions > 0 || publicStats.resources > 0) && (
        <section id="features" className="py-12 md:py-16 bg-muted/20 border-y border-border/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  Live Network Statistics
                </p>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight mt-1">
                  Active Institutional Network
                </h2>
              </div>
              <p className="text-xs text-muted-foreground max-w-md">
                Real-time metrics queried live from the database via secure public endpoints.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              <StatCard
                title="Organisations Enrolled"
                value={`${publicStats.institutions} Registered`}
                icon={Laptop}
                change="Verified Hubs"
                changeType="positive"
                tone="primary"
                description="Universities, workshops & research labs"
              />
              <StatCard
                title="Cataloged Equipment"
                value={`${publicStats.resources} Assets`}
                icon={Microscope}
                change="Live Inventory"
                changeType="positive"
                tone="success"
                description="Available for tracked reservation"
              />
            </div>
          </div>
        </section>
      )}

      {/* Featured Resources Section */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Live Inventory Preview
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight mt-1">
                Multidisciplinary Equipment Catalog
              </h2>
            </div>
            <Link to="/app/discover">
              <Button variant="ghost" className="gap-1.5 text-primary font-semibold">
                <span>View Full Discovery Catalog</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {previewResources.map((resource) => (
              <ResourceThumb key={resource.id} resource={resource} />
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Showcase Glass Card */}
      <section id="architecture" className="pb-16 md:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <GlassCard accent="blue" className="p-8 sm:p-10 rounded-2xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>Enterprise Platform Architecture</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-foreground">
                  Structured for Multi-Tenant Equipment Operations
                </h3>
                <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
                  Every workflow, reservation, and custody verification is secured by PostgreSQL Row-Level Security, cryptographic photo verification, and automated audit trails.
                </p>
              </div>

              <div className="shrink-0 flex flex-col sm:flex-row gap-3">
                <Link to="/app/institution">
                  <Button className="w-full sm:w-auto font-semibold">
                    Open Admin Workspace
                  </Button>
                </Link>
                <Link to="/app/user">
                  <Button variant="outline" className="w-full sm:w-auto font-semibold">
                    Open Member Portal
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
