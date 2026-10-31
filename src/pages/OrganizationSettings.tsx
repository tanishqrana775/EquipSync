/**
 * src/pages/OrganizationSettings.tsx
 * EquipSync – Organization Settings & Domain Verification Management.
 * Allows tenant administrators to configure verified email domains for automatic member onboarding.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Globe,
  Plus,
  X,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  Users,
  Check,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { GlassCard } from '@/components/shared/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/providers/AuthProvider';
import { getMyOrgDomains, setAllowedDomains } from '@/lib/api/rpc';
import { supabase } from '@/lib/supabase';
import { toastError } from '@/lib/errors';
import { toast } from 'sonner';

const PUBLIC_EMAIL_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.in',
  'yahoo.co.in',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'rediffmail.com',
  'mail.com',
  'gmx.com',
  'yandex.com',
];

export function OrganizationSettings() {
  const { user, profile, institutionName } = useAuth();
  const queryClient = useQueryClient();

  const [domainInput, setDomainInput] = useState('');
  const [includeSubdomains, setIncludeSubdomains] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const adminEmailDomain = user?.email?.split('@')[1]?.toLowerCase() || '';
  const isAdminOnPublicEmail = PUBLIC_EMAIL_DOMAINS.includes(adminEmailDomain);

  // 1. Fetch current allowed domains
  const {
    data: domains = [],
    isLoading: domainsLoading,
    error: domainsError,
  } = useQuery({
    queryKey: ['org_allowed_domains', profile?.institution_id],
    queryFn: async () => {
      return await getMyOrgDomains();
    },
    enabled: !!profile?.institution_id,
  });

  // 2. Fetch member verification stats
  const { data: memberStats = { autoVerified: 0, manualVerified: 0, total: 0 } } = useQuery({
    queryKey: ['org_member_stats', profile?.institution_id],
    queryFn: async () => {
      if (!profile?.institution_id) return { autoVerified: 0, manualVerified: 0, total: 0 };
      const { data, error } = await supabase
        .from('profiles')
        .select('verification_method, verification_status')
        .eq('institution_id', profile.institution_id);

      if (error) throw error;
      const verified = (data || []).filter((p) => p.verification_status === 'verified');
      const autoVerified = verified.filter((p) => p.verification_method === 'domain').length;
      const manualVerified = verified.filter((p) => p.verification_method === 'admin').length;
      return {
        autoVerified,
        manualVerified,
        total: (data || []).length,
      };
    },
    enabled: !!profile?.institution_id,
  });

  // Working copy of domains for staging edits
  const [stagedDomains, setStagedDomains] = useState<string[] | null>(null);
  const activeDomains = stagedDomains !== null ? stagedDomains : domains;

  // Mutation to persist domains
  const saveMutation = useMutation({
    mutationFn: async (newDomains: string[]) => {
      return await setAllowedDomains(newDomains);
    },
    onSuccess: (res) => {
      setStagedDomains(null);
      void queryClient.invalidateQueries({ queryKey: ['org_allowed_domains'] });
      void queryClient.invalidateQueries({ queryKey: ['org_member_stats'] });
      void queryClient.invalidateQueries({ queryKey: ['pending_members'] });

      const verifiedCount = res?.newly_verified ?? 0;
      toast.success(
        verifiedCount > 0
          ? `Verified domains updated. ${verifiedCount} member(s) auto-verified.`
          : 'Verified domains updated successfully.'
      );
    },
    onError: (err: unknown) => {
      toastError(err, 'Failed to update verified domains');
    },
  });

  const handleAddDomain = () => {
    let clean = domainInput.trim().toLowerCase();
    if (clean.startsWith('@')) clean = clean.slice(1);
    clean = clean.trim();

    if (!clean) {
      toast.error('Please enter a domain name');
      return;
    }

    if (includeSubdomains && !clean.startsWith('*.')) {
      clean = `*.${clean}`;
    }

    // Check core domain
    const core = clean.startsWith('*.') ? clean.slice(2) : clean;
    if (PUBLIC_EMAIL_DOMAINS.includes(core)) {
      toast.error('Public email providers (such as Gmail or Outlook) cannot be used for auto-verification.');
      return;
    }

    if (activeDomains.includes(clean)) {
      toast.error('This domain is already in your verified list.');
      return;
    }

    if (activeDomains.length >= 20) {
      toast.error('You can add a maximum of 20 verified domains.');
      return;
    }

    setStagedDomains([...activeDomains, clean]);
    setDomainInput('');
    setIncludeSubdomains(false);
  };

  const handleRemoveDomain = (domainToRemove: string) => {
    setStagedDomains(activeDomains.filter((d) => d !== domainToRemove));
  };

  const hasUnsavedChanges = stagedDomains !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organization Preferences"
        title="Organization Settings"
        description="Configure domain auto-verification, institutional details, and member verification policies."
      />

      {/* Admin Public Email Warning Hint */}
      {isAdminOnPublicEmail && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block">Public Email Provider Detected</span>
            <p className="text-muted-foreground leading-relaxed">
              Auto-verification requires an admin email on your organization&apos;s own domain. Because your email address is on a public provider ({adminEmailDomain}), domain-based auto-verification rules cannot be proved.
            </p>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard accent="blue" className="p-5 rounded-2xl space-y-2">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Globe className="h-4 w-4 text-primary" /> Active Verified Domains
          </span>
          <div className="text-2xl font-extrabold text-foreground">
            {activeDomains.length} <span className="text-xs font-normal text-muted-foreground">/ 20 max</span>
          </div>
          <p className="text-[11px] text-muted-foreground">Eligible email patterns for auto-approval</p>
        </GlassCard>

        <GlassCard accent="green" className="p-5 rounded-2xl space-y-2">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Auto-Verified Members
          </span>
          <div className="text-2xl font-extrabold text-foreground">
            {memberStats.autoVerified}
          </div>
          <p className="text-[11px] text-muted-foreground">Verified seamlessly through confirmed email</p>
        </GlassCard>

        <GlassCard accent="none" className="p-5 rounded-2xl space-y-2">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Users className="h-4 w-4 text-muted-foreground" /> Manually Verified
          </span>
          <div className="text-2xl font-extrabold text-foreground">
            {memberStats.manualVerified}
          </div>
          <p className="text-[11px] text-muted-foreground">Approved individually by administrators</p>
        </GlassCard>
      </div>

      {/* Verified Domains Management Card */}
      <div className="surface p-6 rounded-2xl border border-border/80 shadow-xs space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">Verified Email Domains</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Members who confirm an email address ending with these domains will be verified automatically without requiring manual review.
          </p>
        </div>

        {/* Existing Domain Chips */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground block">
            Configured Domains ({activeDomains.length})
          </label>
          {activeDomains.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
              No domains configured yet. Add your institution or organization domain below.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {activeDomains.map((dom) => (
                <Badge
                  key={dom}
                  variant="secondary"
                  className="px-3 py-1.5 rounded-xl text-xs font-mono font-medium flex items-center gap-2 bg-secondary/80 text-foreground border border-border/80 shadow-xs"
                >
                  <Globe className="h-3 w-3 text-primary" />
                  <span>{dom}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDomain(dom)}
                    className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                    title={`Remove ${dom}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Add Domain Input & Controls */}
        <div className="space-y-3 pt-2 border-t border-border/60">
          <label className="text-xs font-semibold text-foreground block">
            Add Verified Domain
          </label>
          <div className="flex flex-col sm:flex-row gap-2 max-w-md">
            <div className="relative flex-1">
              <span className="absolute left-3 top-2.5 text-xs font-mono text-muted-foreground">@</span>
              <Input
                placeholder="institution.edu or lab.ac.uk"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDomain();
                  }
                }}
                className="pl-7 text-xs font-mono"
                disabled={isAdminOnPublicEmail}
              />
            </div>
            <Button
              type="button"
              onClick={handleAddDomain}
              disabled={!domainInput.trim() || isAdminOnPublicEmail}
              size="sm"
              className="gap-1.5 font-semibold text-xs shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Domain</span>
            </Button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="include-subdomains"
              checked={includeSubdomains}
              onCheckedChange={(c) => setIncludeSubdomains(!!c)}
              disabled={isAdminOnPublicEmail}
            />
            <label
              htmlFor="include-subdomains"
              className="text-xs text-muted-foreground cursor-pointer select-none"
            >
              Also include subdomains (e.g. *.domain.edu)
            </label>
          </div>
        </div>

        {/* Save Bar */}
        {hasUnsavedChanges && (
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2 text-xs text-primary font-medium">
              <Info className="h-4 w-4 shrink-0" />
              <span>You have unsaved domain changes.</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStagedDomains(null)}
                disabled={saveMutation.isPending}
                className="w-full sm:w-auto text-xs"
              >
                Reset
              </Button>
              <Button
                size="sm"
                onClick={() => setShowConfirmDialog(true)}
                disabled={saveMutation.isPending}
                className="w-full sm:w-auto text-xs font-semibold shadow-xs"
              >
                {saveMutation.isPending ? 'Saving...' : 'Save Verified Domains'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation AlertDialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span>Update Organization Verified Domains?</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed space-y-2">
              <span className="block">
                Members with confirmed emails on these domains will be verified automatically.
              </span>
              <span className="block font-medium text-foreground">
                Existing pending members matching these domains will be verified immediately.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saveMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={saveMutation.isPending}
              onClick={() => {
                setShowConfirmDialog(false);
                saveMutation.mutate(activeDomains);
              }}
              className="font-semibold"
            >
              Confirm & Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default OrganizationSettings;
