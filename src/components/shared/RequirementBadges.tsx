import { Badge } from '@/components/ui/badge';
import { ShieldAlert, CheckCircle, FileText, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RequirementBadgesProps {
  requirements: string[];
  requiresApproval?: boolean;
  depositRequired?: boolean;
  className?: string;
}

export function RequirementBadges({
  requirements,
  requiresApproval,
  depositRequired,
  className,
}: RequirementBadgesProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {requiresApproval && (
        <Badge
          variant="outline"
          className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1 font-semibold"
        >
          <ShieldAlert className="h-3 w-3" />
          <span>Faculty Sign-off</span>
        </Badge>
      )}

      {depositRequired && (
        <Badge
          variant="outline"
          className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 gap-1 font-semibold"
        >
          <Award className="h-3 w-3" />
          <span>Security Deposit</span>
        </Badge>
      )}

      {requirements.map((req, idx) => (
        <Badge
          key={idx}
          variant="secondary"
          className="text-[10px] text-muted-foreground gap-1 font-normal"
        >
          <FileText className="h-2.5 w-2.5" />
          <span>{req}</span>
        </Badge>
      ))}
    </div>
  );
}
