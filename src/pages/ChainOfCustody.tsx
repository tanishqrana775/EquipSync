/**
 * src/pages/ChainOfCustody.tsx
 * EquipSync – Unified Chain of Custody Hub for Administrators & Members.
 * Replaces the legacy placeholder with real keyset-paginated audit search,
 * timeline verification with anonymized prior return protection, and QR scan-first handover actions.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileCheck2,
  ShieldCheck,
  Search,
  Filter,
  Download,
  QrCode,
  Clock,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  Camera,
  AlertTriangle,
  History,
  Boxes,
  FileText,
  Building,
  User,
  Wrench,
  Check,
  Loader2,
  AlertCircle,
  Info,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { GlassCard } from '@/components/shared/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/providers/AuthProvider';
import { useResources } from '@/hooks/useResources';
import { useBookings } from '@/hooks/useBookings';
import {
  getCustodyChainRpc,
  searchCustodyAuditRpc,
  getMyCustodySummaryRpc,
  resolveAssetQr,
  ResolvedAssetQr,
} from '@/lib/api/rpc';
import { submitSpotAudit, CustodyPhotoInput, compressImage } from '@/lib/custody';
import { CustodyChainTimeline, CustodySegment } from '@/features/custody/CustodyChainTimeline';
import { QrScannerModal } from '@/features/custody/QrScannerModal';
import { toastError } from '@/lib/errors';
import { toast } from 'sonner';

export function ChainOfCustody() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { role, user, profile } = useAuth();
  const isAdmin = role === 'institution';
  const queryClient = useQueryClient();

  const resourceQueryParam = searchParams.get('resource');
  const bookingQueryParam = searchParams.get('booking');

  const [activeTab, setActiveTab] = useState<string>(
    isAdmin ? 'audit_trail' : 'my_custody'
  );

  // Selected resource for asset chains timeline
  const [selectedResourceId, setSelectedResourceId] = useState<string>(
    resourceQueryParam || ''
  );

  const { resources = [] } = useResources();
  const { bookings = [] } = useBookings();

  // -------------------------------------------------------------------------
  // 1. Audit Trail State (Admin Only)
  // -------------------------------------------------------------------------
  const [auditQuery, setAuditQuery] = useState('');
  const [auditFilterAsset, setAuditFilterAsset] = useState<string>('all');
  const [auditFlaggedOnly, setAuditFlaggedOnly] = useState(false);
  const [auditRows, setAuditRows] = useState<any[]>([]);
  const [hasMoreAudit, setHasMoreAudit] = useState(true);
  const [selectedAuditSheet, setSelectedAuditSheet] = useState<any | null>(null);

  const { isLoading: auditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ['custody_audit_search', auditQuery, auditFilterAsset, auditFlaggedOnly],
    queryFn: async () => {
      const data = await searchCustodyAuditRpc({
        query: auditQuery || undefined,
        resourceId: auditFilterAsset !== 'all' ? auditFilterAsset : undefined,
        flaggedOnly: auditFlaggedOnly,
        limit: 50,
      });
      setAuditRows(data ?? []);
      setHasMoreAudit((data?.length ?? 0) >= 50);
      return data;
    },
    enabled: isAdmin && activeTab === 'audit_trail',
  });

  const loadMoreAudit = async () => {
    if (auditRows.length === 0) return;
    const oldestId = auditRows[auditRows.length - 1].id;
    try {
      const more = await searchCustodyAuditRpc({
        query: auditQuery || undefined,
        resourceId: auditFilterAsset !== 'all' ? auditFilterAsset : undefined,
        flaggedOnly: auditFlaggedOnly,
        limit: 50,
        before: oldestId,
      });
      if (!more || more.length === 0) {
        setHasMoreAudit(false);
      } else {
        setAuditRows((prev) => [...prev, ...more]);
        setHasMoreAudit(more.length >= 50);
      }
    } catch (err) {
      toastError(err, 'Failed to load more audit records');
    }
  };

  const handleExportCsv = () => {
    if (auditRows.length === 0) {
      toast.error('No audit records loaded to export');
      return;
    }
    const headers = ['ID', 'Timestamp', 'Action', 'Asset Name', 'Asset Tag', 'Actor Name', 'Actor Role', 'Flagged'];
    const rows = auditRows.map((r) => [
      r.id,
      new Date(r.created_at).toISOString(),
      r.action,
      `"${r.resource_name || ''}"`,
      r.asset_tag || '',
      `"${r.actor_name || ''}"`,
      r.actor_role || '',
      r.metadata?.flagged ? 'TRUE' : 'FALSE',
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `custody_audit_${Date.now()}.csv`;
    a.click();
    toast.success(`Exported ${auditRows.length} audit records to CSV`);
  };

  // -------------------------------------------------------------------------
  // 2. Member Custody Summary (Member Only)
  // -------------------------------------------------------------------------
  const { data: memberSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['my_custody_summary', user?.id],
    queryFn: async () => {
      return await getMyCustodySummaryRpc();
    },
    enabled: !isAdmin,
  });

  // -------------------------------------------------------------------------
  // 3. Asset Chains Timeline (Both Roles)
  // -------------------------------------------------------------------------
  const {
    data: chainSegments = [],
    isLoading: chainLoading,
    error: chainError,
    refetch: refetchChain,
  } = useQuery<CustodySegment[]>({
    queryKey: ['custody_chain', selectedResourceId],
    queryFn: async () => {
      if (!selectedResourceId) return [];
      return (await getCustodyChainRpc({ resourceId: selectedResourceId })) as CustodySegment[];
    },
    enabled: !!selectedResourceId && activeTab === 'asset_chains',
  });

  // -------------------------------------------------------------------------
  // 4. Actions & Scan-First Handover Flow
  // -------------------------------------------------------------------------
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scannedAsset, setScannedAsset] = useState<ResolvedAssetQr | null>(null);
  const [isResolvingQr, setIsResolvingQr] = useState(false);

  // Spot audit modal state (Admin Only)
  const [spotAuditOpen, setSpotAuditOpen] = useState(false);
  const [spotCondition, setSpotCondition] = useState<'excellent' | 'good' | 'minor_wear' | 'damaged' | 'non_functional'>('good');
  const [spotNotes, setSpotNotes] = useState('');
  const [spotPhotos, setSpotPhotos] = useState<Record<string, File>>({});
  const [isSubmittingAudit, setIsSubmittingAudit] = useState(false);

  const handleQrDetected = async (rawCode: string) => {
    try {
      setIsResolvingQr(true);
      const res = await resolveAssetQr(rawCode);
      setScannedAsset(res);
      setScannerOpen(false);
      toast.success(`Asset identified: ${res.name} (${res.asset_tag})`);
    } catch (err) {
      toastError(err, 'Asset not recognized or belongs to another organization');
    } finally {
      setIsResolvingQr(false);
    }
  };

  const handleSpotPhotoSelect = (slot: string, file: File | null) => {
    if (!file) {
      const copy = { ...spotPhotos };
      delete copy[slot];
      setSpotPhotos(copy);
      return;
    }
    setSpotPhotos((prev) => ({ ...prev, [slot]: file }));
  };

  const handleSubmitSpotAudit = async () => {
    if (!scannedAsset) return;
    const requiredSlots = ['front', 'back', 'left', 'right'];
    const missing = requiredSlots.filter((s) => !spotPhotos[s]);
    if (missing.length > 0) {
      toast.error(`Please capture all required photo angles: ${missing.join(', ')}`);
      return;
    }

    try {
      setIsSubmittingAudit(true);
      const photoInputs: CustodyPhotoInput[] = Object.entries(spotPhotos).map(([slot, file]) => ({
        slot,
        file,
        client_captured_at: new Date().toISOString(),
      }));

      await submitSpotAudit({
        institutionId: profile?.institution_id || '',
        resourceId: scannedAsset.resource_id,
        auditId: crypto.randomUUID(),
        photos: photoInputs,
        requiredSlots,
        condition: spotCondition,
        notes: spotNotes,
        qrIdentifier: rawQrValue || scannedAsset.asset_tag,
      });

      toast.success('Spot audit logged and cryptographically signed');
      setSpotAuditOpen(false);
      setScannedAsset(null);
      setSpotPhotos({});
      setSpotNotes('');
      void refetchAudit();
    } catch (err) {
      toastError(err, 'Failed to record spot audit');
    } finally {
      setIsSubmittingAudit(false);
    }
  };

  const rawQrValue = scannedAsset?.asset_tag || '';

  // Pending handover bookings
  const readyForCheckoutBookings = useMemo(() => {
    return bookings.filter((b) => b.status === 'approved');
  }, [bookings]);

  const dueForReturnBookings = useMemo(() => {
    return bookings.filter((b) => b.status === 'active' || (b.status as any) === 'checked_out');
  }, [bookings]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Custody Integrity"
        title="Chain of Custody Hub"
        description="Tamper-evident equipment handover records, multi-angle cryptographic photo proof, and audit trail inspection."
      >
        <Button size="sm" onClick={() => setScannerOpen(true)} className="gap-2 font-semibold shadow-xs">
          <QrCode className="h-4 w-4" />
          <span>Scan Asset QR</span>
        </Button>
      </PageHeader>

      {/* Main Role-Based Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/70 p-1 border border-border/70 rounded-2xl">
          {isAdmin ? (
            <>
              <TabsTrigger value="audit_trail" className="gap-2 text-xs font-semibold rounded-xl">
                <ShieldCheck className="h-4 w-4" />
                <span>All Custody</span>
              </TabsTrigger>
              <TabsTrigger value="asset_chains" className="gap-2 text-xs font-semibold rounded-xl">
                <FileCheck2 className="h-4 w-4" />
                <span>Asset Chains</span>
              </TabsTrigger>
              <TabsTrigger value="actions" className="gap-2 text-xs font-semibold rounded-xl">
                <CheckCircle2 className="h-4 w-4" />
                <span>Actions</span>
              </TabsTrigger>
            </>
          ) : (
            <>
              <TabsTrigger value="my_custody" className="gap-2 text-xs font-semibold rounded-xl">
                <Clock className="h-4 w-4" />
                <span>My Custody</span>
              </TabsTrigger>
              <TabsTrigger value="asset_chains" className="gap-2 text-xs font-semibold rounded-xl">
                <FileCheck2 className="h-4 w-4" />
                <span>Asset Chains</span>
              </TabsTrigger>
              <TabsTrigger value="actions" className="gap-2 text-xs font-semibold rounded-xl">
                <CheckCircle2 className="h-4 w-4" />
                <span>Actions</span>
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* ----------------------------------------------------------------- */}
        {/* TAB 1 (ADMIN): AUDIT TRAIL */}
        {/* ----------------------------------------------------------------- */}
        {isAdmin && (
          <TabsContent value="audit_trail" className="space-y-6">
            <div className="surface p-5 rounded-2xl border border-border/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by asset name, tag, or actor..."
                    value={auditQuery}
                    onChange={(e) => setAuditQuery(e.target.value)}
                    className="pl-9 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    aria-label="Filter audit events by resource"
                    value={auditFilterAsset}
                    onChange={(e) => setAuditFilterAsset(e.target.value)}
                    className="h-9 px-3 rounded-xl border border-input bg-background text-xs font-medium"
                  >
                    <option value="all">All Assets</option>
                    {resources.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title} ({r.tagId})
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-xs">
                    <Switch
                      checked={auditFlaggedOnly}
                      onCheckedChange={setAuditFlaggedOnly}
                      id="flagged-switch"
                    />
                    <label htmlFor="flagged-switch" className="text-xs cursor-pointer select-none">
                      Flagged only
                    </label>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCsv}
                    className="text-xs font-semibold gap-1.5 shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export CSV</span>
                  </Button>
                </div>
              </div>

              {/* Keyset Paginated Audit Table */}
              <div className="rounded-xl border border-border/70 overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b border-border/70 font-semibold text-muted-foreground">
                    <tr>
                      <th className="p-3">Time</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Asset</th>
                      <th className="p-3">Actor</th>
                      <th className="p-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {auditLoading && auditRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
                          Loading audit records...
                        </td>
                      </tr>
                    ) : auditRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-muted-foreground">
                          No custody audit records matched your filter criteria.
                        </td>
                      </tr>
                    ) : (
                      auditRows.map((row) => (
                        <tr
                          key={row.id}
                          onClick={() => setSelectedAuditSheet(row)}
                          className="hover:bg-muted/40 cursor-pointer transition-colors"
                        >
                          <td className="p-3 font-mono text-[11px] text-muted-foreground">
                            {new Date(row.created_at).toLocaleString()}
                          </td>
                          <td className="p-3 font-semibold text-foreground">
                            <span className="flex items-center gap-1.5">
                              {row.metadata?.flagged && (
                                <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                              )}
                              <span>{row.action}</span>
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="font-medium text-foreground block">{row.resource_name}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">{row.asset_tag}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-medium text-foreground block">{row.actor_name}</span>
                            <span className="text-[10px] text-muted-foreground capitalize">{row.actor_role}</span>
                          </td>
                          <td className="p-3 text-right">
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-primary">
                              View
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {hasMoreAudit && auditRows.length > 0 && (
                <div className="text-center pt-2">
                  <Button variant="outline" size="sm" onClick={loadMoreAudit} className="text-xs">
                    Load More Events
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* TAB 1 (MEMBER): MY CUSTODY */}
        {/* ----------------------------------------------------------------- */}
        {!isAdmin && (
          <TabsContent value="my_custody" className="space-y-6">
            {/* Active Holdings */}
            <div className="surface p-5 rounded-2xl border border-border/80 space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-emerald-500" />
                <h3 className="text-base font-bold text-foreground">
                  Equipment Currently In Your Custody
                </h3>
              </div>

              {summaryLoading ? (
                <div className="p-6 text-center text-xs text-muted-foreground">Loading holdings...</div>
              ) : memberSummary?.active_holdings?.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                  You do not currently have any equipment checked out.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {memberSummary?.active_holdings?.map((h: any) => (
                    <div
                      key={h.booking_id}
                      className="p-4 rounded-xl border border-border/80 bg-card/90 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground">{h.name}</span>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px]">
                          In Custody
                        </Badge>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground block">{h.asset_tag}</span>
                      <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                        <span className="text-muted-foreground">Due: {new Date(h.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <Link to={`/app/bookings/${h.booking_id}?mode=checkin`}>
                          <Button size="sm" className="h-7 text-xs font-semibold gap-1">
                            <span>Return Item</span>
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Loan History */}
            <div className="surface p-5 rounded-2xl border border-border/80 space-y-4">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">Completed Equipment Loans</h3>
              </div>

              {memberSummary?.loan_history?.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                  No historical loan records.
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {memberSummary?.loan_history?.map((loan: any) => (
                    <div key={loan.booking_id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-foreground block">{loan.name}</span>
                        <span className="text-[11px] text-muted-foreground font-mono">{loan.asset_tag} • Returned {new Date(loan.end_at).toLocaleDateString()}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedResourceId(loan.resource_id);
                          setActiveTab('asset_chains');
                        }}
                        className="text-xs text-primary font-semibold"
                      >
                        Inspect Chain
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* TAB 2: ASSET CHAINS TIMELINE */}
        {/* ----------------------------------------------------------------- */}
        <TabsContent value="asset_chains" className="space-y-6">
          <div className="surface p-5 rounded-2xl border border-border/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Select Equipment Asset</h3>
                <p className="text-xs text-muted-foreground">
                  View full cryptographic handover history, condition meters, and audit trails.
                </p>
              </div>

              <select
                aria-label="Select resource to view custody timeline"
                value={selectedResourceId}
                onChange={(e) => setSelectedResourceId(e.target.value)}
                className="h-9 px-3 rounded-xl border border-input bg-background text-xs font-semibold max-w-xs"
              >
                <option value="">-- Choose an Equipment Asset --</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} ({r.tagId})
                  </option>
                ))}
              </select>
            </div>

            {selectedResourceId ? (
              <div className="pt-4 border-t border-border/60">
                <CustodyChainTimeline
                  segments={chainSegments}
                  isLoading={chainLoading}
                  error={chainError instanceof Error ? chainError.message : null}
                  onRetry={() => void refetchChain()}
                  isMember={!isAdmin}
                />
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                Please select an asset above to view its immutable chain of custody.
              </div>
            )}
          </div>
        </TabsContent>

        {/* ----------------------------------------------------------------- */}
        {/* TAB 3: ACTIONS & START HANDOVER */}
        {/* ----------------------------------------------------------------- */}
        <TabsContent value="actions" className="space-y-6">
          {/* Resolved QR Result Banner */}
          {scannedAsset && (
            <div className="p-5 rounded-2xl bg-primary/10 border border-primary/30 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    <Check className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{scannedAsset.name}</h4>
                    <span className="text-xs text-muted-foreground font-mono">{scannedAsset.asset_tag}</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setScannedAsset(null)} className="h-7 text-xs">
                  Clear
                </Button>
              </div>

              <div className="pt-2 flex flex-wrap gap-2.5">
                {scannedAsset.actions.map((act) => (
                  <Link
                    key={act.booking_id}
                    to={`/app/bookings/${act.booking_id}?mode=${act.type}`}
                  >
                    <Button size="sm" className="font-semibold text-xs gap-1.5">
                      {act.type === 'checkout' ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Start Check-out Handover</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Start Return Inspection</span>
                        </>
                      )}
                    </Button>
                  </Link>
                ))}

                {scannedAsset.can_audit && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSpotAuditOpen(true)}
                    className="font-semibold text-xs gap-1.5"
                  >
                    <Wrench className="h-3.5 w-3.5 text-primary" />
                    <span>Perform Spot Audit</span>
                  </Button>
                )}

                {scannedAsset.actions.length === 0 && !scannedAsset.can_audit && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <span>No active reservation ready for handover on this equipment right now.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="surface p-5 rounded-2xl border border-border/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Reservations Ready for Check-out
                </span>
                <Badge variant="outline" className="text-xs">
                  {readyForCheckoutBookings.length}
                </Badge>
              </div>

              {readyForCheckoutBookings.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No reservations currently awaiting collection.</p>
              ) : (
                <div className="space-y-2">
                  {readyForCheckoutBookings.slice(0, 4).map((b) => (
                    <div key={b.id} className="p-3 rounded-xl border border-border/60 bg-muted/20 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-foreground block">{b.resourceTitle}</span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          Window: {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <Link to={`/app/bookings/${b.id}?mode=checkout`}>
                        <Button size="sm" className="h-7 text-xs font-semibold">
                          Check out
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="surface p-5 rounded-2xl border border-border/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Active Loans Due for Return
                </span>
                <Badge variant="outline" className="text-xs">
                  {dueForReturnBookings.length}
                </Badge>
              </div>

              {dueForReturnBookings.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No loans currently in checked-out status.</p>
              ) : (
                <div className="space-y-2">
                  {dueForReturnBookings.slice(0, 4).map((b) => (
                    <div key={b.id} className="p-3 rounded-xl border border-border/60 bg-muted/20 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-foreground block">{b.resourceTitle}</span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          Due: {new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <Link to={`/app/bookings/${b.id}?mode=checkin`}>
                        <Button size="sm" variant="outline" className="h-7 text-xs font-semibold">
                          Return
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* QR Identification Modal */}
      {scannerOpen && (
        <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" />
                <span>Scan or Enter Equipment QR Tag</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Scan with your barcode reader or enter the scannable physical QR identifier or asset tag.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground block">
                  Asset QR Identifier or Tag ID
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. EQS-A1B2C3D4E5 or EQP-7K9M2W"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (scanInput.trim()) void handleQrDetected(scanInput.trim());
                      }
                    }}
                    className="text-xs font-mono"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    disabled={!scanInput.trim() || isResolvingQr}
                    onClick={() => void handleQrDetected(scanInput.trim())}
                    className="font-semibold text-xs shrink-0"
                  >
                    {isResolvingQr ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Identify'}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setScannerOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Audit Detail Sheet (Admin Only) */}
      {selectedAuditSheet && (
        <Sheet open={!!selectedAuditSheet} onOpenChange={(open) => !open && setSelectedAuditSheet(null)}>
          <SheetContent className="sm:max-w-md space-y-4">
            <SheetHeader>
              <SheetTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <span>Audit Log Entry #{selectedAuditSheet.id}</span>
              </SheetTitle>
              <SheetDescription className="text-xs font-mono">
                {selectedAuditSheet.action} • {new Date(selectedAuditSheet.created_at).toLocaleString()}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                <span className="text-muted-foreground block text-[11px]">Asset</span>
                <span className="font-bold text-foreground block">{selectedAuditSheet.resource_name}</span>
                <span className="font-mono text-muted-foreground">{selectedAuditSheet.asset_tag}</span>
              </div>

              <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                <span className="text-muted-foreground block text-[11px]">Actor</span>
                <span className="font-bold text-foreground block">{selectedAuditSheet.actor_name}</span>
                <span className="capitalize text-muted-foreground">{selectedAuditSheet.actor_role}</span>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-foreground block">Event Metadata</span>
                <pre className="p-3 rounded-xl bg-black/90 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-60">
                  {JSON.stringify(selectedAuditSheet.metadata, null, 2)}
                </pre>
              </div>

              {selectedAuditSheet.booking_id && (
                <div className="pt-2">
                  <Link to={`/app/bookings/${selectedAuditSheet.booking_id}`}>
                    <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 font-semibold">
                      <FileCheck2 className="h-4 w-4" />
                      <span>Open Associated Reservation</span>
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Spot Audit Dialog (Admin Only) */}
      {spotAuditOpen && scannedAsset && (
        <Dialog open={spotAuditOpen} onOpenChange={setSpotAuditOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" />
                <span>Perform Spot Audit: {scannedAsset.name}</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Asset Tag: {scannedAsset.asset_tag}. Record current physical condition and upload required multi-angle photo evidence.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* Photo slots */}
              <div className="space-y-2">
                <span className="font-semibold text-foreground block">4-Angle Photo Verification</span>
                <div className="grid grid-cols-2 gap-2.5">
                  {['front', 'back', 'left', 'right'].map((slot) => {
                    const file = spotPhotos[slot];
                    return (
                      <div key={slot} className="p-2.5 rounded-xl border border-dashed border-border flex flex-col items-center justify-center gap-1.5 text-center">
                        <span className="text-[11px] font-bold uppercase">{slot} Angle</span>
                        {file ? (
                          <div className="flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Photo captured</span>
                          </div>
                        ) : (
                          <label className="cursor-pointer text-primary hover:underline text-[11px] font-medium flex items-center gap-1">
                            <Camera className="h-3.5 w-3.5" />
                            <span>Upload photo</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(e) => handleSpotPhotoSelect(slot, e.target.files?.[0] || null)}
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Condition Radios */}
              <div className="space-y-1.5">
                <span className="font-semibold text-foreground block">Physical Condition Assessment</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { val: 'excellent', label: '5 - Excellent' },
                    { val: 'good', label: '4 - Good' },
                    { val: 'minor_wear', label: '3 - Minor wear' },
                    { val: 'damaged', label: '2 - Damaged' },
                    { val: 'non_functional', label: '1 - Non-functional' },
                  ].map((c) => (
                    <label
                      key={c.val}
                      className={`p-2 rounded-xl border text-xs cursor-pointer flex items-center gap-2 ${
                        spotCondition === c.val
                          ? 'border-primary bg-primary/10 text-primary font-bold'
                          : 'border-border bg-card hover:bg-muted/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name="spot-condition"
                        value={c.val}
                        checked={spotCondition === c.val}
                        onChange={() => setSpotCondition(c.val as any)}
                        className="hidden"
                      />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground block">Audit Notes</label>
                <Textarea
                  placeholder="Record current wear, missing components, or test notes..."
                  value={spotNotes}
                  onChange={(e) => setSpotNotes(e.target.value)}
                  className="text-xs min-h-[60px]"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSpotAuditOpen(false)} disabled={isSubmittingAudit}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSubmitSpotAudit} disabled={isSubmittingAudit} className="font-semibold">
                {isSubmittingAudit ? 'Signing Audit...' : 'Submit Spot Audit'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default ChainOfCustody;
