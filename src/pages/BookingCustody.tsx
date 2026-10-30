import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  QrCode,
  CheckCircle2,
  Clock,
  User,
  Building,
  KeyRound,
  FileCheck2,
  ArrowLeft,
  AlertCircle,
  Copy,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { GlassCard } from '@/components/shared/GlassCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCustody } from '@/hooks/useCustody';
import { toast } from 'sonner';

export function BookingCustody() {
  const { id } = useParams<{ id: string }>();
  const { custody, loading } = useCustody(id || 'bk-2024-001');

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/app/discover">
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Catalog</span>
          </Button>
        </Link>
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
          <span>Custody Status: Verified Safe</span>
        </Badge>
      </PageHeader>

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
                <StatusBadge status="active" />
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
                RT-3391
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => copyCode('RT-3391')}
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
                {/* Node icon indicator */}
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
