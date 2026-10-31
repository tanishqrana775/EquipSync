import { ResourceStatus, BookingStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type AnyStatus = ResourceStatus | BookingStatus | string;

interface StatusBadgeProps {
  status: AnyStatus;
  className?: string;
  showDot?: boolean;
}

export function StatusBadge({
  status,
  className,
  showDot = true,
}: StatusBadgeProps) {
  const normalized = status.toLowerCase();

  const getStyle = () => {
    switch (normalized) {
      case 'available':
      case 'completed':
      case 'approved':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40',
          dot: 'bg-emerald-500',
          label: normalized === 'available' ? 'Available' : normalized === 'completed' ? 'Completed' : 'Approved',
        };
      case 'reserved':
      case 'active':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40',
          dot: 'bg-blue-500',
          label: normalized === 'reserved' ? 'Reserved' : 'Active In-Use',
        };
      case 'in-use':
      case 'pending':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40',
          dot: 'bg-amber-500',
          label: normalized === 'in-use' ? 'In Custody' : 'Pending Review',
        };
      case 'overdue':
      case 'cancelled':
        return {
          bg: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/40',
          dot: 'bg-red-500',
          label: normalized === 'overdue' ? 'Overdue Return' : 'Cancelled',
        };
      case 'unavailable':
        return {
          bg: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/40',
          dot: 'bg-red-500',
          label: 'Unavailable',
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
    <Badge
      variant="outline"
      className={cn(
        'font-medium text-[11px] px-2 py-0.5 gap-1.5 capitalize transition-colors',
        config.bg,
        className
      )}
    >
      {showDot && (
        <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      )}
      <span>{config.label}</span>
    </Badge>
  );
}
