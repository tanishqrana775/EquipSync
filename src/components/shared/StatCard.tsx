import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  description?: string;
  tone?: 'primary' | 'success' | 'warning' | 'info';
  className?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  change,
  changeType = 'positive',
  description,
  tone = 'primary',
  className,
}: StatCardProps) {
  const toneStyles = {
    primary: {
      iconBg: 'bg-primary/10 text-primary dark:bg-primary/20',
      borderAccent: 'hover:border-primary/40',
    },
    success: {
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
      borderAccent: 'hover:border-emerald-500/40',
    },
    warning: {
      iconBg: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
      borderAccent: 'hover:border-amber-500/40',
    },
    info: {
      iconBg: 'bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400',
      borderAccent: 'hover:border-sky-500/40',
    },
  }[tone];

  return (
    <div
      className={cn(
        'surface p-5 sm:p-6 transition-all duration-200 surface-hover group',
        toneStyles.borderAccent,
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-105',
            toneStyles.iconBg
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          {value}
        </span>

        {change && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-semibold',
              changeType === 'positive' && 'text-emerald-600 dark:text-emerald-400',
              changeType === 'negative' && 'text-destructive',
              changeType === 'neutral' && 'text-muted-foreground'
            )}
          >
            {changeType === 'positive' && <TrendingUp className="h-3 w-3" />}
            {changeType === 'negative' && <TrendingDown className="h-3 w-3" />}
            {change}
          </span>
        )}
      </div>

      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
