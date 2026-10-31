/**
 * src/components/shared/PasswordStrength.tsx
 * EquipSync – Lightweight Password Strength Indicator.
 * Scores password quality across length, numbers, and casing with visual segment bars.
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface PasswordStrengthProps {
  password?: string;
  className?: string;
}

export function computePasswordScore(pwd: string): number {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8) score += 1;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 1;
  if (/\d/.test(pwd)) score += 1;
  if (/[^a-zA-Z0-9]/.test(pwd) || pwd.length >= 12) score += 1;
  return score;
}

const LABELS = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Excellent'];
const COLORS = [
  'bg-muted-foreground/30',
  'bg-destructive',
  'bg-amber-500',
  'bg-blue-500',
  'bg-emerald-500',
];

export function PasswordStrength({ password = '', className }: PasswordStrengthProps) {
  const score = computePasswordScore(password);
  const label = LABELS[score];

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
        <span>Password Strength</span>
        <span
          className={cn(
            score === 1 && 'text-destructive',
            score === 2 && 'text-amber-500',
            score === 3 && 'text-blue-500',
            score === 4 && 'text-emerald-500'
          )}
        >
          {label}
        </span>
      </div>
      <div className="flex gap-1.5 h-1.5">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className={cn(
              'flex-1 rounded-full transition-colors duration-200',
              idx < score ? COLORS[score] : 'bg-muted/70'
            )}
          />
        ))}
      </div>
    </div>
  );
}

export default PasswordStrength;
