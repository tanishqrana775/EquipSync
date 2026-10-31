/**
 * src/features/custody/CustodyStepperFlow.tsx
 * EquipSync – 4-step mobile-first custody workflow for checkout & return handovers.
 * Step 1: Asset QR Verification
 * Step 2: Tamper-Evident Photos with SHA-256 chips
 * Step 3: Accessory Checklist & Condition Rating with Degrade Flagging
 * Step 4: Final Cryptographic Confirmation
 */

import React, { useState } from 'react';
import {
  QrCode,
  Camera,
  CheckSquare,
  ShieldCheck,
  Check,
  Upload,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  FileCheck2,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { QrScannerModal } from './QrScannerModal';
import {
  validateRequiredSlots,
  sha256Hex,
  CustodyPhotoInput,
  AccessoryCheckInput,
} from '@/lib/custody';
import { useCustody } from '@/hooks/useCustody';
import { toastError } from '@/lib/errors';
import { toast } from 'sonner';
import type { Database } from '@/lib/database.types';

type ConditionRating = Database['public']['Enums']['condition_rating'];

const CONDITION_OPTIONS: Array<{
  id: ConditionRating;
  label: string;
  description: string;
}> = [
  { id: 'excellent', label: 'Excellent', description: 'Like-new, pristine condition' },
  { id: 'good', label: 'Good', description: 'Fully working, normal appearance' },
  { id: 'minor_damage', label: 'Minor Damage', description: 'Cosmetic scratch or minor dent, still working' },
  { id: 'major_damage', label: 'Major Damage', description: 'Cracked, impaired function, needs repair' },
  { id: 'non_functional', label: 'Non-functional', description: 'Inoperable, missing core components' },
];

export interface CustodyStepperFlowProps {
  bookingId: string;
  phase: 'checkout' | 'return';
  expectedQr?: string;
  requiredPhotoSlots: string[];
  accessories: Array<{ id: string; name: string; required: boolean }>;
  checkoutAccessoryStates?: Record<string, string>;
  onSuccess?: () => void;
}

interface CapturedPhotoItem {
  file: File;
  hash: string;
  capturedAt: string;
}

export function CustodyStepperFlow({
  bookingId,
  phase,
  expectedQr,
  requiredPhotoSlots,
  accessories,
  checkoutAccessoryStates = {},
  onSuccess,
}: CustodyStepperFlowProps) {
  const { submitCheckOut, submitCheckIn } = useCustody(bookingId);

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [verifiedQr, setVerifiedQr] = useState<string | null>(null);

  // Photos state
  const [photos, setPhotos] = useState<Record<string, CapturedPhotoItem>>({});
  const [isHashing, setIsHashing] = useState<string | null>(null);

  // Checklist state (accessoryId -> boolean: true = present, false = missing)
  const [accessoryChecks, setAccessoryChecks] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const a of accessories) {
      initial[a.id] = true;
    }
    return initial;
  });

  // Condition and notes
  const [selectedCondition, setSelectedCondition] = useState<ConditionRating | null>(
    phase === 'checkout' ? 'good' : null
  );
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedResult, setCompletedResult] = useState<{
    status: string;
    flagged?: boolean;
    flagReasons?: string[];
  } | null>(null);

  // Validation rules
  const missingSlots = validateRequiredSlots(requiredPhotoSlots, photos);

  // Flag detection: any accessory present at checkout that is unchecked now
  const hasUncheckedOutItem =
    phase === 'return' &&
    accessories.some((acc) => {
      const wasPresentAtCheckout = checkoutAccessoryStates[acc.id] !== 'missing';
      const isCheckedNow = accessoryChecks[acc.id];
      return wasPresentAtCheckout && !isCheckedNow;
    });

  const isNotesRequired =
    (hasUncheckedOutItem ||
      (selectedCondition !== null &&
        ['minor_damage', 'damaged', 'major_damage', 'missing_parts', 'non_functional'].includes(
          selectedCondition
        ))) &&
    phase === 'return';

  const handlePhotoSelect = async (slot: string, file: File | null) => {
    if (!file) return;
    try {
      setIsHashing(slot);
      const hash = await sha256Hex(file);
      setPhotos((prev) => ({
        ...prev,
        [slot]: {
          file,
          hash,
          capturedAt: new Date().toISOString(),
        },
      }));
    } catch (err: unknown) {
      toastError(err, 'Failed to compute cryptographic hash for photo');
    } finally {
      setIsHashing(null);
    }
  };

  const handleFinalSubmit = async () => {
    if (!verifiedQr) {
      toast.error('Asset QR code must be verified first');
      setCurrentStep(1);
      return;
    }

    if (missingSlots.length > 0) {
      toast.error(`Please capture all required angles: ${missingSlots.join(', ')}`);
      setCurrentStep(2);
      return;
    }

    if (!selectedCondition) {
      toast.error('Please select an equipment condition');
      setCurrentStep(3);
      return;
    }

    if (isNotesRequired && !notes.trim()) {
      toast.error('Detailed notes are required when reporting damage or missing parts');
      setCurrentStep(3);
      return;
    }

    try {
      setIsSubmitting(true);

      const photoInputs: CustodyPhotoInput[] = Object.entries(photos).map(([slot, item]) => ({
        slot,
        file: item.file,
        client_captured_at: item.capturedAt,
      }));

      const checks: AccessoryCheckInput[] = accessories.map((acc) => ({
        accessory_id: acc.id,
        name: acc.name,
        state: accessoryChecks[acc.id] ? 'present' : 'missing',
      }));

      let resultBk;
      if (phase === 'checkout') {
        resultBk = await submitCheckOut({
          photos: photoInputs,
          condition: selectedCondition,
          notes: notes || 'Verified at checkout handover',
          accessoryChecks: checks,
          qrIdentifier: verifiedQr,
        });
      } else {
        resultBk = await submitCheckIn({
          photos: photoInputs,
          condition: selectedCondition,
          notes: notes || 'Verified at return handover',
          accessoryChecks: checks,
          qrIdentifier: verifiedQr,
        });
      }

      setCompletedResult({
        status: resultBk.status,
        flagged: hasUncheckedOutItem || selectedCondition !== 'good',
      });
      toast.success(
        phase === 'checkout'
          ? 'Check-out handover completed! Custody transferred.'
          : 'Return check-in submitted for inspection.'
      );
      onSuccess?.();
    } catch (err: unknown) {
      toastError(err, `${phase === 'checkout' ? 'Check-out' : 'Check-in'} failed`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stepper Header
  const stepTitles = [
    { num: 1, label: 'Asset QR' },
    { num: 2, label: 'Photos' },
    { num: 3, label: 'Checklist' },
    { num: 4, label: 'Confirm' },
  ];

  if (completedResult) {
    return (
      <div className="surface p-6 sm:p-8 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 text-center space-y-4 animate-fade-in">
        <div className="h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-foreground">
            {phase === 'checkout' ? 'Check-out Handover Complete' : 'Return Check-in Submitted'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {phase === 'checkout'
              ? 'Equipment accepted with verified QR seal and photo evidence. Custody pass active.'
              : completedResult.flagged
              ? 'Return submitted with defect report. An incident was automatically logged and administrators notified.'
              : 'Return submitted successfully with all components intact. Awaiting custodian sign-off.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="surface p-5 sm:p-7 rounded-2xl border-2 border-primary/20 space-y-6">
      {/* Stepper Progress Bar */}
      <div className="flex items-center justify-between border-b border-border/70 pb-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-primary">
            {phase === 'checkout' ? 'Check-out Handover' : 'Return Check-in'}
          </span>
          <h3 className="text-base font-bold text-foreground">
            Step {currentStep} of 4: {stepTitles[currentStep - 1].label}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          {stepTitles.map((st) => (
            <div
              key={st.num}
              className={`h-2 rounded-full transition-all ${
                st.num === currentStep
                  ? 'w-7 bg-primary'
                  : st.num < currentStep
                  ? 'w-2 bg-emerald-500'
                  : 'w-2 bg-muted'
              }`}
            />
          ))}
        </div>
      </div>

      {/* STEP 1: Scan or Enter QR */}
      {currentStep === 1 && (
        <div className="space-y-4 animate-fade-in">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              <span>Verify Physical Asset QR Tag</span>
            </h4>
            <p className="text-xs text-muted-foreground">
              Scan the physical tag on the equipment or manually enter the code below to ensure custody integrity.
            </p>
          </div>

          <QrScannerModal
            bookingId={bookingId}
            phase={phase}
            expectedQr={expectedQr}
            onVerified={(qr) => setVerifiedQr(qr)}
          />

          <div className="flex justify-end pt-3">
            <Button
              disabled={!verifiedQr}
              onClick={() => setCurrentStep(2)}
              className="gap-2 font-semibold"
            >
              <span>Next: Multi-Angle Photos</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Multi-Angle Photos with SHA-256 Chips */}
      {currentStep === 2 && (
        <div className="space-y-5 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Camera className="h-4 w-4 text-primary" />
                <span>Multi-Angle Condition Evidence</span>
              </h4>
              <p className="text-xs text-muted-foreground">
                Capture every required angle. Photos are hashed client-side with SHA-256 for tamper-evidence.
              </p>
            </div>
            <Badge variant={missingSlots.length === 0 ? 'default' : 'secondary'} className="text-xs shrink-0">
              {missingSlots.length === 0 ? 'All Angles Ready' : `${missingSlots.length} Missing`}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {requiredPhotoSlots.map((slot) => {
              const item = photos[slot];
              const hashingThis = isHashing === slot;

              return (
                <div
                  key={slot}
                  className={`p-3 rounded-xl border text-center space-y-2 transition-all ${
                    item
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : 'border-dashed border-border/80 bg-muted/20'
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                    {slot} Angle
                  </span>

                  {hashingThis ? (
                    <div className="py-4 flex flex-col items-center justify-center text-xs text-muted-foreground space-y-1">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-[10px]">Hashing SHA-256...</span>
                    </div>
                  ) : item ? (
                    <div className="space-y-1.5 py-1">
                      <div className="flex items-center justify-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                        <Check className="h-3.5 w-3.5" />
                        <span>Ready</span>
                      </div>
                      {/* Short 8-char Hash Chip */}
                      <span className="inline-block font-mono text-[10px] bg-background border px-1.5 py-0.5 rounded text-foreground">
                        #{item.hash.slice(0, 8)}
                      </span>
                      <span className="block text-[10px] text-muted-foreground truncate">
                        {new Date(item.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ) : (
                    <label className="cursor-pointer block py-3 hover:opacity-80">
                      <Upload className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                      <span className="text-[11px] text-primary font-medium">Upload Angle</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => void handlePhotoSelect(slot, e.target.files?.[0] || null)}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <Button variant="outline" size="sm" onClick={() => setCurrentStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button
              disabled={missingSlots.length > 0}
              onClick={() => setCurrentStep(3)}
              className="gap-2 font-semibold"
            >
              <span>Next: Checklist & Condition</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Accessory Checklist & Condition Rating */}
      {currentStep === 3 && (
        <div className="space-y-5 animate-fade-in">
          {/* Accessory Checklist with Out vs Back Diff */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" />
                <span>Accessory Checklist</span>
              </h4>
              <span className="text-[11px] text-muted-foreground">Check all present items</span>
            </div>

            {hasUncheckedOutItem && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-center gap-2 animate-fade-in">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="font-semibold">
                  This return will be flagged for the owner. Detailed notes required.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {accessories.map((acc) => {
                const isChecked = accessoryChecks[acc.id] ?? true;
                const wasPresentAtCheckout = checkoutAccessoryStates[acc.id] !== 'missing';

                return (
                  <label
                    key={acc.id}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isChecked
                        ? 'border-border/80 bg-card'
                        : 'border-destructive/40 bg-destructive/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          setAccessoryChecks((prev) => ({
                            ...prev,
                            [acc.id]: e.target.checked,
                          }))
                        }
                        className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                      />
                      <span className="font-semibold text-foreground">{acc.name}</span>
                    </div>

                    {phase === 'return' && (
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span className="text-muted-foreground">
                          Out: <strong>{wasPresentAtCheckout ? 'Present' : 'Missing'}</strong>
                        </span>
                        <Badge
                          variant={isChecked ? 'outline' : 'destructive'}
                          className="text-[9px] px-1 py-0 font-mono"
                        >
                          Back: {isChecked ? 'Yes' : 'Missing'}
                        </Badge>
                      </div>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Condition Rating Radio Group */}
          <div className="space-y-2.5 pt-2 border-t border-border/50">
            <label className="text-xs font-bold text-foreground block">
              Equipment Condition (Required):
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CONDITION_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                    selectedCondition === opt.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border/80 hover:bg-muted/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="conditionRating"
                    value={opt.id}
                    checked={selectedCondition === opt.id}
                    onChange={() => setSelectedCondition(opt.id)}
                    className="mt-0.5 text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="font-bold text-xs text-foreground block">{opt.label}</span>
                    <span className="text-[11px] text-muted-foreground leading-tight">{opt.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Notes field with mandatory validation */}
          <div className="space-y-1.5 pt-2 border-t border-border/50 text-xs">
            <label className="font-semibold text-foreground block">
              Handover Remarks & Notes
              {isNotesRequired && <span className="text-destructive font-bold ml-1">* Required</span>}
            </label>
            <Input
              placeholder={
                isNotesRequired
                  ? 'Describe missing components, cosmetic damage, or operational defects in detail...'
                  : 'Optional observations...'
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={isNotesRequired && !notes.trim() ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {isNotesRequired && !notes.trim() && (
              <p className="text-[11px] text-destructive font-medium">
                Detailed notes are required when condition is Minor Damage or worse, or accessories are missing.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <Button variant="outline" size="sm" onClick={() => setCurrentStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button
              disabled={!selectedCondition || (isNotesRequired && !notes.trim())}
              onClick={() => setCurrentStep(4)}
              className="gap-2 font-semibold"
            >
              <span>Next: Review & Confirm</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: Review & Final Confirmation */}
      {currentStep === 4 && (
        <div className="space-y-5 animate-fade-in">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Review & Sign Off Handover</span>
            </h4>
            <p className="text-xs text-muted-foreground">
              Verify your physical inspection summary. Once signed, the evidence is cryptographically sealed in the audit log.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border/80 space-y-3 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-border/40">
              <span className="text-muted-foreground">Verified Asset Tag:</span>
              <span className="font-mono font-bold text-foreground">{verifiedQr}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/40">
              <span className="text-muted-foreground">Recorded Condition:</span>
              <Badge variant="outline" className="capitalize font-semibold text-xs">
                {selectedCondition?.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/40">
              <span className="text-muted-foreground">Accessories Verified:</span>
              <span className="font-bold text-foreground">
                {Object.values(accessoryChecks).filter(Boolean).length} of {accessories.length} present
              </span>
            </div>
            <div className="py-1">
              <span className="text-muted-foreground block mb-1">SHA-256 Photo Proofs:</span>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(photos).map(([slot, item]) => (
                  <span key={slot} className="font-mono text-[10px] bg-muted px-2 py-0.5 rounded border">
                    {slot}: #{item.hash.slice(0, 8)}
                  </span>
                ))}
              </div>
            </div>
            {notes && (
              <div className="py-1 border-t border-border/40">
                <span className="text-muted-foreground block text-[11px] mb-0.5">Handover Notes:</span>
                <p className="bg-muted/40 p-2 rounded text-foreground text-[11px] leading-relaxed">
                  {notes}
                </p>
              </div>
            )}
          </div>

          {hasUncheckedOutItem && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Return will be marked as disputed and flagged for admin inspection due to missing accessories.
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <Button variant="outline" size="sm" disabled={isSubmitting} onClick={() => setCurrentStep(3)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={handleFinalSubmit}
              className="gap-2 font-semibold shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Submitting Evidence...</span>
                </>
              ) : (
                <>
                  <FileCheck2 className="h-4 w-4" />
                  <span>{phase === 'checkout' ? 'Sign & Accept Check-Out' : 'Sign & Submit Return'}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
