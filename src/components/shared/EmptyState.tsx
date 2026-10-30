import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'surface flex flex-col items-center justify-center p-8 md:p-12 text-center rounded-2xl border-dashed',
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/80 text-muted-foreground ring-8 ring-secondary/30 mb-4">
        <Icon className="h-7 w-7 text-primary/80" />
      </div>
      <h3 className="text-base sm:text-lg font-bold text-foreground mb-1">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm" className="font-semibold shadow-sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
