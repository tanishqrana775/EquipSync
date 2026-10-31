import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Building,
  ArrowLeft,
  Copy,
  Camera,
  AlertTriangle,
  Upload,
  Check,
  X,
  FileText,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { GlassCard } from '@/components/shared/GlassCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCustody } from '@/hooks/useCustody';
import { useAuth } from '@/providers/AuthProvider';
import { validateRequiredSlots, CustodyPhotoInput, AccessoryCheckInput } from '@/lib/custody';
import { toastError } from '@/lib/errors';
import { toast } from 'sonner';

export function BookingCustody() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const {
    custody,
    booking,
    requiredPhotoSlots,
    accessories,
    photos,
    signedPhotoUrls,
    events,
    incidents,
    loading,
    submitCheckOut,
    submitCheckIn,
    inspectReturn,
    reportIncident,
  } = useCustody(id || 'bk-2024-001');

  // Photo capture state (slot -> File)
  const [capturedPhotos, setCapturedPhotos] = useState<Record<string, File>>({});
  const [returnRadio, setReturnRadio] = useState<'working' | 'safe' | 'damaged' | null>(null);
  const [notes, setNotes] = useState('');
  const [accessoryStates, setAccessoryStates] = useState<Record<string, 'present' | 'missing' | 'damaged'>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [incidentNotice, setIncidentNotice] = useState<string | null>(null);
  // Return inspection state (admin)
  const [inspectNotes, setInspectNotes] = useState('');
  const [isInspecting, setIsInspecting] = useState(false);

  // Incident reporting state
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [incidentType, setIncidentType] = useState<'damage' | 'missing_accessory' | 'other'>('damage');
  const [incidentSeverity, setIncidentSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [incidentDesc, setIncidentDesc] = useState('');

  if (loading || !custody) {
    return (
      <div className="surface p-12 text-center rounded-2xl">
        <Clock className="h-8 w-8 text-primary animate-spin mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Loading chain of custody cryptographic verification record...
        </p>
      </div>
    );
  }

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    toast.success(`Verification code copied: ${code}`);
  };

  const missingSlots = validateRequiredSlots(requiredPhotoSlots, capturedPhotos);
  const isEligibleForHandover = booking?.status === 'approved';
  const isEligibleForReturn = booking?.status === 'checked_out';
  const isPendingInspection = booking?.status === 'returned' && role === 'institution';

  // Quality gate calculations
  const allAccessoriesChecked = accessories.length === 0 || accessories.every((acc) => !!accessoryStates[acc.id]);
  const hasMissingAccessory = Object.values(accessoryStates).some((s) => s === 'missing');
  const effectiveCondition: 'good' | 'minor_wear' | 'damaged' | 'missing_parts' = hasMissingAccessory
    ? 'missing_parts'
    : returnRadio === 'damaged'
    ? 'damaged'
    : returnRadio === 'safe'
    ? 'minor_wear'
    : 'good';

  const isNotesRequired = (effectiveCondition === 'damaged' || effectiveCondition === 'missing_parts') && isEligibleForReturn;
  const isCheckInDisabled =
    !returnRadio ||
    missingSlots.length > 0 ||
    !allAccessoriesChecked ||
    (isNotesRequired && !notes.trim()) ||
    isSubmitting;
  const isCheckOutDisabled = missingSlots.length > 0 || isSubmitting;
  const handlePhotoSelect = (slot: string, file: File | null) => {
    if (!file) return;
    setCapturedPhotos((prev) => ({ ...prev, [slot]: file }));
  };

  const handleHandoverSubmit = async (phase: 'checkout' | 'checkin') => {
    if (missingSlots.length > 0) {
      toast.error(`Please capture all required photo angles: ${missingSlots.join(', ')}`);
      return;
    }

    try {
      setIsSubmitting(true);
      const photoInputs: CustodyPhotoInput[] = Object.entries(capturedPhotos).map(([slot, file]) => ({
        slot,
        file,
        client_captured_at: new Date().toISOString(),
      }));

      const checks: AccessoryCheckInput[] = accessories.map((acc) => ({
        accessory_id: acc.id,
        name: acc.name,
        state: accessoryStates[acc.id] || 'present',
      }));

      if (phase === 'checkout') {
        await submitCheckOut({
          photos: photoInputs,
          condition: 'good',
          notes: notes || 'Verified during handover',
          accessoryChecks: checks,
        });
      } else {
        await submitCheckIn({
          photos: photoInputs,
          condition: effectiveCondition,
          notes: notes || 'Returned to locker',
          accessoryChecks: checks,
        });
        if (effectiveCondition === 'damaged' || effectiveCondition === 'missing_parts') {
          setIncidentNotice('An incident was automatically opened and organisation administrators were notified of this defect.');
        }
      }
      setCapturedPhotos({});
      setNotes('');
      setReturnRadio(null);
    } catch (err) {
      toastError(err, `${phase === 'checkout' ? 'Check-out' : 'Check-in'} failed`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInspect = async (accept: boolean) => {
    try {
      setIsInspecting(true);
      await inspectReturn({ accept, notes: inspectNotes || undefined });
      setInspectNotes('');
    } catch (err) {
      toastError(err, 'Failed to complete inspection');
    } finally {
      setIsInspecting(false);
    }
  };

  const handleReportIncident = async () => {
    if (!incidentDesc.trim()) {
      toast.error('Please enter a description of the issue');
      return;
    }
    try {
      await reportIncident({
        severity: incidentSeverity,
        type: incidentType,
        description: incidentDesc,
      });
      setShowIncidentForm(false);
      setIncidentDesc('');
    } catch (err) {
      toastError(err, 'Failed to report incident');
    }
  };

  const returnPasscode = booking ? `RT-${booking.id.slice(-4).toUpperCase()}` : 'RT-3391';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/app/discover">
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Catalog</span>
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowIncidentForm(!showIncidentForm)}
          className="h-8 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Report Incident</span>
        </Button>
      </div>

      <PageHeader
        eyebrow="Chain of Custody Verification"
        title="Digital Custody Audit Trail"
        description="Immutable record tracking authorized custody transfers, condition state audits, and cryptographic return verifications."
      >
        <Badge
          variant="outline"
          className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1.5 font-bold py-1 px-3"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Custody Status: {custody.custodyStatus.toUpperCase()}</span>
        </Badge>
      </PageHeader>

      {/* Incident Report Collapsible Form */}
      {showIncidentForm && (
        <div className="surface p-5 rounded-2xl border border-destructive/40 bg-destructive/5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <h4 className="text-sm font-bold text-foreground">File Incident Report</h4>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => setShowIncidentForm(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="font-semibold block mb-1">Issue Type</label>
              <select
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value as never)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
              >
                <option value="damage">Equipment Damage</option>
                <option value="missing_accessory">Missing Accessory</option>
                <option value="other">Other Irregularity</option>
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-1">Severity Level</label>
              <select
                value={incidentSeverity}
                onChange={(e) => setIncidentSeverity(e.target.value as never)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
              >
                <option value="low">Low (Cosmetic wear)</option>
                <option value="medium">Medium (Requires servicing)</option>
                <option value="high">High (Broken / unusable)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">Description of Issue</label>
            <Textarea
              placeholder="Describe physical damage, missing components, or malfunction details..."
              value={incidentDesc}
              onChange={(e) => setIncidentDesc(e.target.value)}
              className="text-xs"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowIncidentForm(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" onClick={handleReportIncident}>
              Submit Incident Report
            </Button>
          </div>
        </div>
      )}

      {/* Custody Overview Glass Card */}
      <GlassCard accent="green" className="rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <img
              src={custody.resourceImage}
              alt={custody.resourceTitle}
              className="h-20 w-20 md:h-24 md:w-24 rounded-xl object-cover border border-emerald-500/30 shrink-0 shadow-sm"
            />
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Record #{custody.id} • Booking #{custody.bookingId}
              </span>
              <h3 className="text-xl font-bold text-foreground">
                {custody.resourceTitle}
              </h3>
              <p className="text-xs text-muted-foreground">
                Active Borrower: <span className="font-semibold text-foreground">{custody.borrowerName}</span> ({custody.borrowerDepartment})
              </p>
              <div className="pt-1 flex items-center gap-2">
                <StatusBadge status={booking?.status === 'checked_out' ? 'active' : (booking?.status === 'approved' ? 'approved' : 'pending')} />
                <span className="text-xs text-muted-foreground">
                  Current Custodian: <strong className="text-foreground">{custody.currentCustodian}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Handover Verification Card */}
          <div className="surface p-4 rounded-xl border border-border/80 flex flex-col items-center justify-center min-w-[220px] text-center space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Return Verification Passcode
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-black tracking-widest text-primary">
                {returnPasscode}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => copyCode(returnPasscode)}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <span className="text-[10px] text-muted-foreground">
              Provide to locker desk upon return inspection
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Interactive Handover / Return Section */}
      {(isEligibleForHandover || isEligibleForReturn) && (
        <div className="surface p-6 rounded-2xl border-2 border-primary/20 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" />
                <span>
                  {isEligibleForHandover ? 'Complete Check-Out Handover' : 'Complete Return Check-In'}
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Capture required multi-angle condition photos and verify all included accessories.
              </p>
            </div>
            <Badge variant={missingSlots.length === 0 ? 'default' : 'secondary'} className="text-xs">
              {missingSlots.length === 0
                ? 'All Angles Captured'
                : `${missingSlots.length} angle(s) required`}
            </Badge>
          </div>

          {/* Required Photo Slots Upload Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {requiredPhotoSlots.map((slot) => {
              const file = capturedPhotos[slot];
              return (
                <div
                  key={slot}
                  className={`p-3 rounded-xl border text-center space-y-2 transition-all ${
                    file ? 'border-emerald-500/50 bg-emerald-50/20 dark:bg-emerald-950/20' : 'border-dashed border-border/80 bg-muted/20'
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                    {slot} View
                  </span>
                  {file ? (
                    <div className="flex items-center justify-center gap-1 text-xs text-emerald-600 font-semibold py-2">
                      <Check className="h-4 w-4" />
                      <span>Ready</span>
                    </div>
                  ) : (
                    <label className="cursor-pointer block py-2 hover:opacity-80">
                      <Upload className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                      <span className="text-[11px] text-primary font-medium">Upload Angle</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => handlePhotoSelect(slot, e.target.files?.[0] || null)}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>

          {/* Accessory Checklist */}
          {accessories.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-foreground block">Accessory Verification:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {accessories.map((acc) => (
                  <div key={acc.id} className="p-2.5 rounded-lg border border-border/60 bg-muted/30 flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{acc.name}</span>
                    <select
                      value={accessoryStates[acc.id] || 'present'}
                      onChange={(e) =>
                        setAccessoryStates((prev) => ({ ...prev, [acc.id]: e.target.value as never }))
                      }
                      className="rounded border border-input bg-background px-2 py-0.5 text-xs font-semibold"
                    >
                      <option value="present">Present</option>
                      <option value="missing">Missing</option>
                      <option value="damaged">Damaged</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Return Quality Gate Radio Group (Check-in Mode) */}
          {isEligibleForReturn && (
            <div className="space-y-3 pt-2 border-t border-border/60">
              <label className="text-xs font-bold text-foreground block">
                Equipment Operational State (Required):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'working', label: 'Working', desc: 'Fully functional, no defects' },
                  { id: 'safe', label: 'Safe', desc: 'Usable with minor cosmetic wear' },
                  { id: 'damaged', label: 'Damaged', desc: 'Broken, malfunctioning, defect' },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className={`p-3 rounded-xl border flex flex-col gap-1 cursor-pointer transition-all ${
                      returnRadio === opt.id
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border/80 hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="returnCondition"
                        value={opt.id}
                        checked={returnRadio === opt.id}
                        onChange={() => setReturnRadio(opt.id as never)}
                        className="text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-bold text-foreground">{opt.label}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground pl-5">{opt.desc}</span>
                  </label>
                ))}
              </div>
              {hasMissingAccessory && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  Notice: Missing accessory detected. Return condition automatically set to missing_parts.
                </p>
              )}
            </div>
          )}

          {/* Condition and Notes */}
          <div className="space-y-2 pt-1">
            <label className="font-semibold text-xs block">
              {isEligibleForReturn ? 'Return Notes' : 'Handover Notes'}
              {isNotesRequired && <span className="text-destructive font-bold ml-1">* Required</span>}
            </label>
            <Input
              placeholder={
                isNotesRequired
                  ? 'Please describe damage or missing parts in detail...'
                  : 'Any remarks or custody observations...'
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`h-9 text-xs ${isNotesRequired && !notes.trim() ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            />
            {isNotesRequired && !notes.trim() && (
              <p className="text-[11px] text-destructive font-medium">
                Detailed return notes are required when reporting damaged equipment or missing parts.
              </p>
            )}
          </div>

          {/* Incident notice if recorded */}
          {incidentNotice && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{incidentNotice}</span>
            </div>
          )}

          {/* Gated Action Button via Quality Gate */}
          <div className="flex justify-end pt-2">
            <Button
              disabled={isEligibleForHandover ? isCheckOutDisabled : isCheckInDisabled}
              onClick={() => handleHandoverSubmit(isEligibleForHandover ? 'checkout' : 'checkin')}
              className="gap-2 font-semibold shadow-sm"
            >
              <span>
                {isSubmitting
                  ? 'Verifying & Uploading...'
                  : isEligibleForHandover
                  ? 'Confirm Check-Out Handover'
                  : 'Submit Return Check-In'}
              </span>
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Admin Return Inspection Section */}
      {isPendingInspection && (
        <div className="surface p-6 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/10 dark:bg-emerald-950/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" />
              <h3 className="text-base font-bold text-foreground">
                Official Return Inspection Panel
              </h3>
            </div>
            <Badge variant="outline" className="text-xs">
              Inspection Required
            </Badge>
          </div>

          {/* Borrower Return Report Details */}
          <div className="p-4 rounded-xl bg-background border border-border/70 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Borrower Condition Report</span>
                <span className="font-semibold text-foreground capitalize">
                  {events.find((e) => e.phase === 'checkin')?.condition || 'Standard Return'}
                </span>
              </div>
              {incidents.length > 0 && (
                <Badge variant="destructive" className="text-[10px] font-bold">
                  {incidents.length} Incident(s) Logged
                </Badge>
              )}
            </div>

            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-bold mb-0.5">Borrower Return Notes</span>
              <p className="text-foreground bg-muted/30 p-2.5 rounded-lg border border-border/50">
                {events.find((e) => e.phase === 'checkin')?.notes || 'No defects noted by borrower.'}
              </p>
            </div>

            {/* Return Photos Thumbnail Strip */}
            {photos.filter((p) => p.phase === 'checkin').length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Return Photo Evidence</span>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {photos
                    .filter((p) => p.phase === 'checkin')
                    .map((p) => (
                      <div key={p.id} className="relative rounded-lg overflow-hidden border border-border h-16 w-16 shrink-0 bg-muted">
                        <img
                          src={signedPhotoUrls[p.storage_path] || ''}
                          alt={p.slot}
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-white text-center py-0.5 capitalize truncate">
                          {p.slot}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          <Input
            placeholder="Inspection observations and restock approval notes..."
            value={inspectNotes}
            onChange={(e) => setInspectNotes(e.target.value)}
            className="text-xs"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isInspecting}
              onClick={() => handleInspect(false)}
              className="text-xs font-semibold text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              Dispute Return
            </Button>
            <Button
              size="sm"
              disabled={isInspecting}
              onClick={() => handleInspect(true)}
              className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Accept & Close Booking</span>
            </Button>
          </div>
        </div>
      )}

      {/* Custody Stage Stepper */}
      <div className="surface p-6 rounded-2xl space-y-6">
        <div>
          <h3 className="text-base font-bold text-foreground">
            Custody Lifecycle Audit Trail
          </h3>
          <p className="text-xs text-muted-foreground">
            Complete chronological steps and department endorsements
          </p>
        </div>

        <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-2.5 sm:before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border">
          {custody.steps.map((step, idx) => {
            const isCompleted = step.status === 'completed';
            const isCurrent = step.status === 'current';
            const isUpcoming = step.status === 'upcoming';

            return (
              <div key={step.id} className="relative">
                <div
                  className={`absolute -left-6 sm:-left-8 top-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors ${
                    isCompleted
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                      : isCurrent
                      ? 'bg-primary border-primary text-white ring-4 ring-primary/20 animate-pulse'
                      : 'bg-card border-border text-muted-foreground'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <span className="text-[11px] font-bold">{idx + 1}</span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4
                      className={`text-sm font-bold ${
                        isCurrent
                          ? 'text-primary'
                          : isCompleted
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {step.stage}
                    </h4>

                    {isCompleted && (
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                        Completed
                      </Badge>
                    )}
                    {isCurrent && (
                      <Badge variant="default" className="text-[10px]">
                        Active Stage
                      </Badge>
                    )}
                    {isUpcoming && (
                      <Badge variant="secondary" className="text-[10px]">
                        Upcoming
                      </Badge>
                    )}

                    {step.timestamp && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {step.timestamp}
                      </span>
                    )}
                  </div>

                  {step.actorName && (
                    <p className="text-xs text-muted-foreground">
                      Verified by <strong className="text-foreground">{step.actorName}</strong> ({step.actorRole})
                    </p>
                  )}

                  {step.notes && (
                    <p className="text-xs text-muted-foreground/90 bg-muted/40 p-2.5 rounded-lg border border-border/50 mt-1.5 leading-relaxed">
                      {step.notes}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
