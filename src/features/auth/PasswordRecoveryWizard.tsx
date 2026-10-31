/**
 * src/features/auth/PasswordRecoveryWizard.tsx
 * EquipSync – 3-Step Password Recovery Wizard (Request -> Verify -> Reset).
 * Step 3 reachable strictly via state upon successful verifyOtp.
 * Backed by equipsync:recovery sessionStorage guard with 60s cooldown and 5-attempt lockout.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowLeft, KeyRound, Lock, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/shared/PasswordInput';
import { OtpInput } from '@/components/shared/OtpInput';
import { PasswordStrength } from '@/components/shared/PasswordStrength';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  requestPasswordOtp,
  verifyRecoveryOtp,
  updatePassword,
  clearRecoveryMode,
  isRecoveryMode,
  signOut,
} from '@/lib/auth';
import { toastError } from '@/lib/errors';
import { toast } from 'sonner';

export interface PasswordRecoveryWizardProps {
  mode?: 'page' | 'dialog';
  initialEmail?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export function PasswordRecoveryWizard({
  mode = 'page',
  initialEmail = '',
  onSuccess,
  onCancel,
}: PasswordRecoveryWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState(initialEmail);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [failedAttempts, setFailedAttempts] = useState(0);

  const completedRef = useRef(false);
  const isVerifyingRef = useRef(false);
  // In dialog mode, closing the dialog leaves the flow
  useEffect(() => {
    return () => {
      if (mode === 'dialog' && !completedRef.current && isRecoveryMode()) {
        clearRecoveryMode();
        void signOut();
      }
    };
  }, [mode]);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // STEP 1: Request Recovery OTP
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setIsSubmitting(true);
      await requestPasswordOtp(email.trim());
      // Neutral message on request
      toast.success("If an account exists for that email, we've sent a 6-digit code.");
      setStep(2);
      setResendCooldown(60);
      setFailedAttempts(0);
      setOtpError(null);
      setOtpCode('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('limit')) {
        toast.error('Too many requests. Please wait a few minutes before trying again.');
      } else {
        // Maintain neutral response
        toast.success("If an account exists for that email, we've sent a 6-digit code.");
        setStep(2);
        setResendCooldown(60);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // STEP 2: Verify Recovery OTP
  const handleVerifyOtp = async (codeToVerify?: string) => {
    if (isVerifyingRef.current) return;
    const code = codeToVerify || otpCode;
    if (code.length < 6) {
      setOtpError('Please enter all 6 digits of the code.');
      return;
    }

    try {
      isVerifyingRef.current = true;
      setIsSubmitting(true);
      setOtpError(null);
      await verifyRecoveryOtp(email.trim(), code);
      setStep(3);
      toast.success('Code verified. Set your new password.');
    } catch (err: unknown) {
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);

      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      if (nextAttempts >= 5) {
        toast.error('Maximum verification attempts exceeded. Please request a new code.');
        setStep(1);
        setOtpCode('');
        setFailedAttempts(0);
        return;
      }

      if (msg.includes('expired')) {
        setOtpError('The recovery code has expired. Please request a new one.');
      } else if (msg.includes('rate') || msg.includes('limit')) {
        setOtpError('Too many verification attempts. Please wait a few minutes.');
      } else {
        setOtpError(`Invalid code. ${5 - nextAttempts} attempt(s) remaining.`);
      }
    } finally {
      setIsSubmitting(false);
      isVerifyingRef.current = false;
    }
  };

  // STEP 3: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters in length.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      try {
        await updatePassword(newPassword);
      } catch (e: unknown) {
        const msg = String(e && typeof e === 'object' && 'message' in e ? (e as { message?: unknown }).message : e);
        if (!msg.toLowerCase().includes('session')) {
          throw e;
        }
      }
      completedRef.current = true;
      clearRecoveryMode();
      try {
        await signOut();
      } catch {
        // ignore
      }

      toast.success('Password reset successfully. Please sign in with your new password.');
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/login', { replace: true });
      }
    } catch (err: unknown) {
      toastError(err, 'Failed to update password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cardContainerClass =
    mode === 'dialog'
      ? 'w-full'
      : 'w-full max-w-md auth-glass-card rounded-2xl shadow-xl animate-fade-in';

  return (
    <Card className={cardContainerClass}>
      {/* ----------------------------------------------------------------- */}
      {/* STEP 1: REQUEST CODE */}
      {/* ----------------------------------------------------------------- */}
      {step === 1 && (
        <>
          <CardHeader className="space-y-1 text-center pb-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2 shadow-xs">
              <KeyRound className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              Reset Password
            </CardTitle>
            <CardDescription className="text-xs">
              Enter your email address and we will send you a 6-digit verification code.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground block">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@organization.edu"
                    className="pl-9 text-sm"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || !email.trim()}
                className="w-full font-semibold shadow-xs"
              >
                {isSubmitting ? 'Sending code...' : 'Send Recovery Code'}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex justify-center border-t border-border/70 pt-4">
            {mode === 'dialog' ? (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Sign In</span>
              </Link>
            )}
          </CardFooter>
        </>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* STEP 2: VERIFY OTP */}
      {/* ----------------------------------------------------------------- */}
      {step === 2 && (
        <>
          <CardHeader className="space-y-1 text-center pb-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2 shadow-xs">
              <Mail className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              Enter Verification Code
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed max-w-xs mx-auto">
              We sent a 6-digit code to <strong className="text-foreground font-semibold">{maskEmail(email)}</strong>. Code is valid for 10 minutes.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <OtpInput
              value={otpCode}
              onChange={(val) => {
                setOtpCode(val);
                setOtpError(null);
              }}
              onComplete={(code) => void handleVerifyOtp(code)}
              error={otpError}
              disabled={isSubmitting}
            />

            <Button
              type="button"
              onClick={() => void handleVerifyOtp()}
              disabled={isSubmitting || otpCode.length < 6}
              className="w-full font-semibold shadow-xs"
            >
              {isSubmitting ? 'Verifying code...' : 'Verify Code'}
            </Button>

            <div className="flex flex-col sm:flex-row items-center justify-between text-xs pt-1 gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setOtpCode('');
                  setOtpError(null);
                }}
                className="text-muted-foreground hover:text-foreground font-medium underline-offset-4 hover:underline"
              >
                Use a different email
              </button>

              <button
                type="button"
                disabled={resendCooldown > 0 || isSubmitting}
                onClick={() => void handleRequestOtp()}
                className={`font-semibold flex items-center gap-1 ${
                  resendCooldown > 0
                    ? 'text-muted-foreground cursor-not-allowed'
                    : 'text-primary hover:underline'
                }`}
              >
                <RefreshCw className={`h-3 w-3 ${isSubmitting ? 'animate-spin' : ''}`} />
                <span>
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                </span>
              </button>
            </div>
          </CardContent>

          <CardFooter className="flex justify-center border-t border-border/70 pt-4">
            {mode === 'dialog' ? (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Sign In</span>
              </Link>
            )}
          </CardFooter>
        </>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* STEP 3: RESET PASSWORD */}
      {/* ----------------------------------------------------------------- */}
      {step === 3 && (
        <>
          <CardHeader className="space-y-1 text-center pb-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-2 shadow-xs">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              Create New Password
            </CardTitle>
            <CardDescription className="text-xs">
              Choose a strong password with at least 8 characters.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground block">
                  New Password
                </label>
                <PasswordInput
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  autoFocus
                />
              </div>

              <PasswordStrength password={newPassword} />

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground block">
                  Confirm Password
                </label>
                <PasswordInput
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  required
                />
              </div>

              {passwordError && (
                <p role="alert" className="text-xs font-semibold text-destructive">
                  {passwordError}
                </p>
              )}

              <Button
                type="submit"
                onClick={handleResetPassword}
                disabled={isSubmitting || newPassword.length < 8 || newPassword !== confirmPassword}
                className="w-full font-semibold shadow-xs"
              >
                {isSubmitting ? 'Updating password...' : 'Update Password & Sign In'}
              </Button>
            </form>
          </CardContent>
        </>
      )}
    </Card>
  );
}

export default PasswordRecoveryWizard;
