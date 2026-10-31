/**
 * src/features/custody/OwnerInspectionPanel.tsx
 * EquipSync – Admin Return Inspection & Multi-Angle Cryptographic Comparison Panel.
 * Side-by-side checkout vs return photo proof, SHA-256 integrity verification,
 * checklist diff, condition degradation comparison, and server-side dispute resolution.
 */

import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Check,
  X,
  AlertTriangle,
  Camera,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { verifyPhotoIntegrity, AccessoryCheckInput } from '@/lib/custody';
import { useCustody } from '@/hooks/useCustody';
import { toastError } from '@/lib/errors';
import { toast } from 'sonner';
import type { Database } from '@/lib/database.types';

type ConditionRating = Database['public']['Enums']['condition_rating'];

const CONDITION_RANKS: Record<string, number> = {
  excellent: 5,
  good: 4,
  minor_wear: 3,
  minor_damage: 3,
  damaged: 2,
  major_damage: 2,
  missing_parts: 2,
  non_functional: 1,
};

export interface OwnerInspectionPanelProps {
  bookingId: string;
  checkoutCondition?: ConditionRating;
  returnCondition?: ConditionRating;
  borrowerNotes?: string;
  accessories: Array<{ id: string; name: string; required: boolean }>;
  checkoutAccessoryStates?: Record<string, string>;
  returnAccessoryStates?: Record<string, string>;
  photos: Array<{
    id: string;
    slot: string;
    phase: string;
    storage_path: string;
    sha256: string;
    client_captured_at: string;
  }>;
  signedPhotoUrls: Record<string, string>;
  onInspected?: () => void;
}

export function OwnerInspectionPanel({
  bookingId,
  checkoutCondition = 'good',
  returnCondition = 'good',
  borrowerNotes,
  accessories,
  checkoutAccessoryStates = {},
  returnAccessoryStates = {},
  photos,
  signedPhotoUrls,
  onInspected,
}: OwnerInspectionPanelProps) {
  const { inspectReturn } = useCustody(bookingId);

  // Integrity verification status per photo storage_path
  const [integrityStatus, setIntegrityStatus] = useState<
    Record<string, 'verified' | 'mismatch' | 'verifying'>
  >({});
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);

  // Admin inspection form state
  const [adminCondition, setAdminCondition] = useState<ConditionRating>(returnCondition);
  const [adminAccessories, setAdminAccessories] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const a of accessories) {
      initial[a.id] = returnAccessoryStates[a.id] !== 'missing';
    }
    return initial;
  });
  const [adminNotes, setAdminNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<{
    status: string;
    message: string;
  } | null>(null);

  // Group photos into checkout vs return pairs
  const photoSlots = useMemo(() => {
    const slots = new Set<string>();
    for (const p of photos) slots.add(p.slot);
    return Array.from(slots).sort();
  }, [photos]);

  const checkoutRank = CONDITION_RANKS[checkoutCondition] ?? 4;
  const returnRank = CONDITION_RANKS[returnCondition] ?? 4;
  const isConditionWorse = returnRank < checkoutRank;

  // Verify single photo
  const verifyOnePhoto = async (photo: { storage_path: string; sha256: string }) => {
    setIntegrityStatus((prev) => ({ ...prev, [photo.storage_path]: 'verifying' }));
    try {
      const res = await verifyPhotoIntegrity(photo);
      setIntegrityStatus((prev) => ({
        ...prev,
        [photo.storage_path]: res.ok ? 'verified' : 'mismatch',
      }));
      if (res.ok) {
        toast.success(`Photo ${photo.storage_path.split('/').pop()} integrity verified`);
      } else {
        toast.error(`Tamper mismatch! Expected ${res.expected.slice(0, 8)}, got ${res.actual.slice(0, 8)}`);
      }
    } catch (err: unknown) {
      setIntegrityStatus((prev) => ({ ...prev, [photo.storage_path]: 'mismatch' }));
      toastError(err, 'Failed to verify photo integrity');
    }
  };

  // Verify all photos
  const verifyAllPhotos = async () => {
    try {
      setIsVerifyingAll(true);
      await Promise.all(
        photos.map(async (p) => {
          setIntegrityStatus((prev) => ({ ...prev, [p.storage_path]: 'verifying' }));
          try {
            const res = await verifyPhotoIntegrity(p);
            setIntegrityStatus((prev) => ({
              ...prev,
              [p.storage_path]: res.ok ? 'verified' : 'mismatch',
            }));
          } catch {
            setIntegrityStatus((prev) => ({ ...prev, [p.storage_path]: 'mismatch' }));
          }
        })
      );
      toast.success('Completed SHA-256 integrity verification for all photo records.');
    } finally {
      setIsVerifyingAll(false);
    }
  };

  const handleInspectSubmit = async () => {
    try {
      setIsSubmitting(true);
      const checks: AccessoryCheckInput[] = accessories.map((acc) => ({
        accessory_id: acc.id,
        name: acc.name,
        state: adminAccessories[acc.id] ? 'present' : 'missing',
      }));

      const res = await inspectReturn({
        condition: adminCondition,
        accessoryChecks: checks,
        notes: adminNotes || undefined,
      });

      setInspectionResult({
        status: res.status,
        message:
          res.status === 'closed'
            ? 'Return approved clean. Booking is closed and asset restocked.'
            : 'Return disputed due to condition degradation or missing accessories. Incident opened.',
      });
      onInspected?.();
    } catch (err: unknown) {
      toastError(err, 'Failed to complete inspection');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (inspectionResult) {
    return (
      <div
        className={`p-6 rounded-2xl border text-center space-y-3 animate-fade-in ${
          inspectionResult.status === 'closed'
            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
            : 'bg-destructive/10 border-destructive/40 text-destructive'
        }`}
      >
        <div className="flex items-center justify-center gap-2">
          {inspectionResult.status === 'closed' ? (
            <CheckCircle2 className="h-6 w-6" />
          ) : (
            <AlertTriangle className="h-6 w-6" />
          )}
          <h4 className="text-base font-bold">
            Inspection Recorded: {inspectionResult.status.toUpperCase()}
          </h4>
        </div>
        <p className="text-xs max-w-md mx-auto leading-relaxed">{inspectionResult.message}</p>
      </div>
    );
  }

  return (
    <div className="surface p-6 rounded-2xl border-2 border-primary/20 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">
              Official Custodian Inspection & Evidence Audit
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Compare checkout handover evidence with return inspection to resolve custody status.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          disabled={isVerifyingAll || photos.length === 0}
          onClick={verifyAllPhotos}
          className="text-xs font-semibold gap-1.5 shrink-0"
        >
          {isVerifyingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          <span>Verify All SHA-256 Hashes</span>
        </Button>
      </div>

      {/* 1. Condition Shift Comparison Strip */}
      <div className="p-4 rounded-xl bg-card border border-border/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-muted-foreground block text-[10px] uppercase font-bold">Checkout Condition</span>
            <Badge variant="outline" className="text-xs capitalize font-semibold mt-0.5">
              {checkoutCondition.replace('_', ' ')}
            </Badge>
          </div>
          <span className="text-muted-foreground font-bold">→</span>
          <div>
            <span className="text-muted-foreground block text-[10px] uppercase font-bold">Borrower Return Report</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge variant="outline" className="text-xs capitalize font-semibold">
                {returnCondition.replace('_', ' ')}
              </Badge>
              {isConditionWorse && (
                <Badge variant="destructive" className="text-[10px] font-bold">
                  Worse
                </Badge>
              )}
            </div>
          </div>
        </div>

        {borrowerNotes && (
          <div className="max-w-md">
            <span className="text-muted-foreground block text-[10px] uppercase font-bold mb-0.5">Borrower Return Remarks</span>
            <p className="text-[11px] text-foreground bg-muted/40 p-2 rounded border border-border/60">
              {borrowerNotes}
            </p>
          </div>
        )}
      </div>

      {/* 2. Side-by-Side Photo Comparison */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Photo Evidence Comparison (Checkout vs Return)
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {photoSlots.map((slot) => {
            const outPhoto = photos.find((p) => p.slot === slot && p.phase === 'checkout');
            const inPhoto = photos.find((p) => p.slot === slot && p.phase === 'checkin');

            return (
              <div key={slot} className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-3">
                <span className="text-xs font-bold text-foreground block capitalize">{slot} View</span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Checkout Photo */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground block">Checkout Handover</span>
                    <div className="aspect-video rounded-lg overflow-hidden border border-border/70 bg-card relative">
                      {outPhoto && signedPhotoUrls[outPhoto.storage_path] ? (
                        <img
                          src={signedPhotoUrls[outPhoto.storage_path]}
                          alt={`${slot} checkout`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground text-[10px]">
                          No photo
                        </div>
                      )}
                    </div>
                    {outPhoto && (
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-mono text-muted-foreground">#{outPhoto.sha256.slice(0, 8)}</span>
                        <button
                          type="button"
                          onClick={() => void verifyOnePhoto(outPhoto)}
                          className="text-primary hover:underline font-medium"
                        >
                          {integrityStatus[outPhoto.storage_path] === 'verified' ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Verified</span>
                          ) : integrityStatus[outPhoto.storage_path] === 'mismatch' ? (
                            <span className="text-destructive font-bold">MISMATCH</span>
                          ) : integrityStatus[outPhoto.storage_path] === 'verifying' ? (
                            'Verifying...'
                          ) : (
                            'Verify'
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Return Photo */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground block">Return Check-in</span>
                    <div className="aspect-video rounded-lg overflow-hidden border border-border/70 bg-card relative">
                      {inPhoto && signedPhotoUrls[inPhoto.storage_path] ? (
                        <img
                          src={signedPhotoUrls[inPhoto.storage_path]}
                          alt={`${slot} return`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground text-[10px]">
                          No photo
                        </div>
                      )}
                    </div>
                    {inPhoto && (
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-mono text-muted-foreground">#{inPhoto.sha256.slice(0, 8)}</span>
                        <button
                          type="button"
                          onClick={() => void verifyOnePhoto(inPhoto)}
                          className="text-primary hover:underline font-medium"
                        >
                          {integrityStatus[inPhoto.storage_path] === 'verified' ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Verified</span>
                          ) : integrityStatus[inPhoto.storage_path] === 'mismatch' ? (
                            <span className="text-destructive font-bold">MISMATCH</span>
                          ) : integrityStatus[inPhoto.storage_path] === 'verifying' ? (
                            'Verifying...'
                          ) : (
                            'Verify'
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Accessory Checklist Diff Table */}
      <div className="space-y-2.5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Accessory Checklist Verification (Out / Back / Admin Sign-off)
        </h4>

        <div className="rounded-xl border border-border/80 overflow-hidden divide-y divide-border/60 text-xs">
          <div className="grid grid-cols-12 bg-muted/50 p-2.5 font-bold text-foreground text-[11px]">
            <span className="col-span-5">Accessory Component</span>
            <span className="col-span-2 text-center">Out</span>
            <span className="col-span-2 text-center">Back</span>
            <span className="col-span-3 text-right">Admin Inspection</span>
          </div>

          {accessories.map((acc) => {
            const outState = checkoutAccessoryStates[acc.id] !== 'missing' ? 'present' : 'missing';
            const backState = returnAccessoryStates[acc.id] !== 'missing' ? 'present' : 'missing';
            const isMismatch = outState === 'present' && backState === 'missing';

            return (
              <div
                key={acc.id}
                className={`grid grid-cols-12 items-center p-2.5 transition-colors ${
                  isMismatch ? 'bg-destructive/10 text-destructive font-semibold' : 'bg-card'
                }`}
              >
                <span className="col-span-5 truncate">{acc.name}</span>
                <span className="col-span-2 text-center capitalize text-muted-foreground">{outState}</span>
                <span className="col-span-2 text-center capitalize">
                  {backState === 'missing' ? (
                    <span className="text-destructive font-bold">Missing</span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">Present</span>
                  )}
                </span>
                <div className="col-span-3 flex justify-end">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adminAccessories[acc.id] ?? true}
                      onChange={(e) =>
                        setAdminAccessories((prev) => ({
                          ...prev,
                          [acc.id]: e.target.checked,
                        }))
                      }
                      className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                    />
                    <span className="text-[11px]">Present</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Custodian Final Sign-Off Form */}
      <div className="space-y-4 pt-3 border-t border-border/70">
        <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
          Admin Inspection Outcome Decision
        </h4>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground block">
            Verified Final Condition:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { id: 'excellent' as ConditionRating, label: 'Excellent' },
              { id: 'good' as ConditionRating, label: 'Good' },
              { id: 'minor_damage' as ConditionRating, label: 'Minor Damage' },
              { id: 'major_damage' as ConditionRating, label: 'Major Damage' },
              { id: 'non_functional' as ConditionRating, label: 'Non-functional' },
            ].map((opt) => (
              <label
                key={opt.id}
                className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                  adminCondition === opt.id
                    ? 'border-primary bg-primary/10 font-bold text-primary ring-1 ring-primary'
                    : 'border-border/80 hover:bg-muted/40 text-muted-foreground'
                }`}
              >
                <input
                  type="radio"
                  name="adminCondition"
                  value={opt.id}
                  checked={adminCondition === opt.id}
                  onChange={() => setAdminCondition(opt.id)}
                  className="sr-only"
                />
                <span className="text-xs block">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 text-xs">
          <label className="font-semibold text-foreground block">
            Custodian Inspection Notes (Required if disputing):
          </label>
          <Input
            placeholder="Document physical scratches, missing components, or closure clearance..."
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            className="text-xs"
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button
            disabled={isSubmitting}
            onClick={handleInspectSubmit}
            className="gap-2 font-semibold shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Evaluating Outcome...</span>
              </>
            ) : (
              <>
                <FileCheck2 className="h-4 w-4" />
                <span>Submit Official Return Inspection</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
