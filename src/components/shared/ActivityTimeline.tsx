import { ActivityItem } from '@/lib/types';
import { CheckCircle2, Clock, ShieldCheck, Box, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActivityTimelineProps {
  items?: ActivityItem[];
  limit?: number;
  className?: string;
}

export function ActivityTimeline({
  items = [],
  limit,
  className,
}: ActivityTimelineProps) {
  const displayItems = limit ? items.slice(0, limit) : items;

  const getIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'custody':
        return <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case 'booking':
        return <Clock className="h-4 w-4 text-primary" />;
      case 'resource':
        return <Box className="h-4 w-4 text-amber-500" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getBadgeBg = (type: ActivityItem['type']) => {
    switch (type) {
      case 'custody':
        return 'bg-emerald-500/10 border-emerald-500/20';
      case 'booking':
        return 'bg-primary/10 border-primary/20';
      case 'resource':
        return 'bg-amber-500/10 border-amber-500/20';
      default:
        return 'bg-secondary border-border';
    }
  };

  return (
    <div className={cn('flow-root', className)}>
      <ul className="-mb-8">
        {displayItems.map((item, idx) => {
          const isLast = idx === displayItems.length - 1;

          return (
            <li key={item.id} className="relative pb-6">
              {!isLast && (
                <span
                  className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-border/60"
                  aria-hidden="true"
                />
              )}
              <div className="relative flex items-start space-x-3.5">
                <div>
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-xl border shadow-xs',
                      getBadgeBg(item.type)
                    )}
                  >
                    {getIcon(item.type)}
                  </div>
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground">
                      {item.actor}
                    </span>{' '}
                    <span className="text-[11px] text-muted-foreground/80">
                      ({item.actorRole})
                    </span>{' '}
                    {item.action}{' '}
                    <span className="font-medium text-foreground">
                      {item.target}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
                    <Clock className="h-3 w-3" />
                    <span>{item.timestamp}</span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
