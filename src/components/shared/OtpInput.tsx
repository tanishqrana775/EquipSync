/**
 * src/components/shared/OtpInput.tsx
 * EquipSync – Accessible One-Time Passcode (OTP) Input.
 * Built on shadcn input-otp with numeric keyboard, auto-submit on completion,
 * paste support, aria-live errors, and error shake animation.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { cn } from '@/lib/utils';
import '@/styles/entry.css';

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
  error?: string | null;
  className?: string;
  autoFocus?: boolean;
}

export function OtpInput({
  value,
  onChange,
  onComplete,
  length = Number(import.meta.env.VITE_OTP_LENGTH) || 6,
  disabled = false,
  error,
  className,
  autoFocus = true,
}: OtpInputProps) {
  const [shouldShake, setShouldShake] = useState(false);
  const prevErrorRef = useRef(error);

  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      setShouldShake(true);
      const timer = setTimeout(() => setShouldShake(false), 500);
      return () => clearTimeout(timer);
    }
    prevErrorRef.current = error;
  }, [error]);

  const handleChange = (code: string) => {
    onChange(code);
    if (code.length === length && onComplete) {
      onComplete(code);
    }
  };

  return (
    <div className={cn('flex flex-col items-center gap-2.5', className)}>
      <div className={cn('transition-transform', shouldShake && 'animate-shake')}>
        <InputOTP
          maxLength={length}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          autoFocus={autoFocus}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-invalid={!!error}
          aria-describedby={error ? 'otp-error-message' : undefined}
        >
          <InputOTPGroup className="gap-2 sm:gap-2.5">
            {Array.from({ length }).map((_, idx) => (
              <InputOTPSlot
                key={idx}
                index={idx}
                className={cn(
                  'rounded-xl border shadow-xs transition-colors',
                  error ? 'border-destructive ring-1 ring-destructive' : 'border-input'
                )}
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      {error && (
        <p
          id="otp-error-message"
          role="alert"
          aria-live="polite"
          className="text-xs font-semibold text-destructive text-center animate-fade-in"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default OtpInput;
