import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface UtilisationBarProps {
  percentage: number;
  label?: string;
  subtext?: string;
  showPercentText?: boolean;
  className?: string;
}

export function UtilisationBar({
  percentage,
  label,
  subtext,
  showPercentText = true,
  className,
}: UtilisationBarProps) {
  const clamped = Math.min(100, Math.max(0, percentage));

  const getIndicatorColor = () => {
    if (clamped >= 85) return 'bg-destructive';
    if (clamped >= 65) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-xs">
        {label && <span className="font-medium text-foreground">{label}</span>}
        {showPercentText && (
          <span className="font-semibold text-muted-foreground ml-auto">
            {clamped}%
          </span>
        )}
      </div>

      <Progress
        value={clamped}
        className="h-2 bg-secondary"
        indicatorClassName={getIndicatorColor()}
      />

      {subtext && (
        <p className="text-[11px] text-muted-foreground">{subtext}</p>
      )}
    </div>
  );
}
