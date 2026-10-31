/**
 * src/components/shared/PasswordInput.tsx
 * EquipSync – Accessible password input with visibility toggle.
 * Uses shadcn Input and Lucide icons with aria-pressed.
 */

import React, { useState, forwardRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface PasswordInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, disabled, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative flex items-center w-full">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          disabled={disabled}
          className={cn('pr-10 transition-all', className)}
          {...props}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          tabIndex={-1}
          className="absolute right-2.5 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors disabled:pointer-events-none disabled:opacity-50"
        >
          {visible ? (
            <EyeOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
