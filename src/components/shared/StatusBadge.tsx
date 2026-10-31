import { ResourceStatus, BookingStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type AnyStatus = ResourceStatus | BookingStatus | string;

interface StatusBadgeProps {
  status: AnyStatus;
  className?: string;
  showDot?: boolean;
  decisionNote?: string | null;
  cancelledByAdmin?: boolean;
}

export function StatusBadge({
  status,
  className,
  showDot = true,
  decisionNote,
  cancelledByAdmin,
}: StatusBadgeProps) {
  const normalized = (status || '').toLowerCase();

  const getStyle = () => {
    switch (normalized) {
      case 'available':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40',
          dot: 'bg-emerald-500',
          label: 'Available',
        };
      case 'approved':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40',
          dot: 'bg-emerald-500',
          label: 'Approved',
        };
      case 'completed':
      case 'closed':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40',
          dot: 'bg-emerald-500',
          label: 'Closed',
        };
      case 'checked_out':
      case 'active':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40',
          dot: 'bg-blue-500',
          label: 'Checked out',
        };
      case 'returned':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40',
          dot: 'bg-purple-500',
          label: 'Returned',
        };
      case 'reserved':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40',
          dot: 'bg-blue-500',
          label: 'Reserved',
        };
      case 'in-use':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40',
          dot: 'bg-blue-500',
          label: 'In Custody',
        };
      case 'pending':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40',
          dot: 'bg-amber-500',
          label: 'Pending admin check',
        };
      case 'rejected':
        return {
          bg: 'bg-destructive/10 text-destructive border-destructive/20 dark:bg-destructive/20 dark:text-destructive',
          dot: 'bg-destructive',
          label: 'Declined',
          note: decisionNote,
        };
      case 'cancelled':
        return {
          bg: 'bg-muted text-muted-foreground border-border/80 dark:bg-muted/40 dark:text-muted-foreground dark:border-border',
          dot: 'bg-muted-foreground',
          label: cancelledByAdmin ? 'Cancelled by Admin' : 'Cancelled by You',
          note: decisionNote,
        };
      case 'disputed':
        return {
          bg: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/40',
          dot: 'bg-red-500',
          label: 'Disputed',
        };
      case 'maintenance':
        return {
          bg: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40',
          dot: 'bg-amber-500',
          label: 'Under maintenance',
        };
      case 'retired':
        return {
          bg: 'bg-muted text-muted-foreground border-border/80 dark:bg-muted/40 dark:text-muted-foreground dark:border-border',
          dot: 'bg-muted-foreground',
          label: 'Retired',
        };
      default:
        return {
          bg: 'bg-secondary text-secondary-foreground border-border',
          dot: 'bg-muted-foreground',
          label: status,
        };
    }
  };

  const config = getStyle();

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Badge
        variant="outline"
        className={cn(
          'font-medium text-[11px] px-2 py-0.5 gap-1.5 transition-colors',
          config.bg,
          className
        )}
      >
        {showDot && (
          <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', config.dot)} />
        )}
        <span>{config.label}</span>
      </Badge>
      {decisionNote && (normalized === 'rejected' || normalized === 'cancelled') && (
        <span className="text-[11px] text-muted-foreground italic pl-1 leading-tight">
          &ldquo;{decisionNote}&rdquo;
        </span>
      )}
    </div>
  );
}
