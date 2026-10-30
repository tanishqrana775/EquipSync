import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  gradientBorder?: boolean;
  hoverEffect?: boolean;
  accent?: 'none' | 'blue' | 'green';
}

export function GlassCard({
  children,
  className,
  gradientBorder = false,
  hoverEffect = false,
  accent = 'none',
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        'glass p-5 md:p-6 transition-all duration-200',
        hoverEffect && 'surface-hover cursor-pointer',
        accent === 'blue' && 'border-primary/25 bg-gradient-to-br from-primary/[0.04] to-card/80',
        accent === 'green' && 'border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.04] to-card/80',
        gradientBorder && 'border-transparent ring-1 ring-primary/20',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
