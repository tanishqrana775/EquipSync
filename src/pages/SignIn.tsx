import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, Mail, Lock, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/shared/PasswordInput';
import { OtpInput } from '@/components/shared/OtpInput';
import { useEffect } from 'react';
import { signIn, resendVerification, verifySignUpOtp } from '@/lib/auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useAuth } from '@/providers/AuthProvider';
import { toastError } from '@/lib/errors';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function SignIn() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [confirmOtp, setConfirmOtp] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  useEffect(() => {
    if (searchParams.get('verified') === '1') {
      toast.success('Email verified successfully! You may now sign in.');
    }
  }, [searchParams]);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      setIsSubmitting(true);
      const session = await signIn(values.email, values.password);
      await refresh();
      toast.success('Signed in successfully');
      const metaRole = session.user.user_metadata?.role;
      if (metaRole === 'institution_admin') {
        navigate('/app/institution', { replace: true });
      } else {
        navigate('/app/user', { replace: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('email not confirmed') || msg.toLowerCase().includes('not confirmed')) {
        setUnconfirmedEmail(values.email);
        void resendVerification(values.email).catch(() => {});
        toast.error('Email not confirmed. Please enter your 6-digit confirmation code below.');
      } else if (msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('limit')) {
        toast.error('Too many emails requested. Please wait a few minutes.');
      } else {
        toastError(err, 'Failed to sign in. Please verify your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmOtp = async (codeToVerify?: string) => {
    if (!unconfirmedEmail) return;
    const code = codeToVerify || confirmOtp;
    if (code.length < 6) {
      setConfirmError('Please enter all 6 digits of the confirmation code.');
      return;
    }
    try {
      setIsConfirming(true);
      setConfirmError(null);
      const session = await verifySignUpOtp(unconfirmedEmail, code);
      await refresh();
      toast.success('Account confirmed successfully!');
      const metaRole = session.user.user_metadata?.role;
      navigate(metaRole === 'institution_admin' ? '/app/institution' : '/app/user', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      if (msg.includes('expired')) {
        setConfirmError('Confirmation code has expired. Click resend below.');
      } else {
        setConfirmError('Invalid confirmation code. Please check your inbox.');
      }
    } finally {
      setIsConfirming(false);
    }
  };

  if (unconfirmedEmail) {
    return (
      <div className="w-full max-w-md animate-fade-in">
        <Card className="auth-glass-card rounded-2xl text-center">
          <CardHeader className="space-y-1 pb-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-2 shadow-xs">
              <Mail className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              Confirm Your Account
            </CardTitle>
            <CardDescription className="text-xs">
              Enter the 6-digit confirmation code sent to <strong className="text-foreground">{unconfirmedEmail}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <OtpInput
              value={confirmOtp}
              onChange={(val) => {
                setConfirmOtp(val);
                setConfirmError(null);
              }}
              onComplete={(code) => void handleConfirmOtp(code)}
              error={confirmError}
              disabled={isConfirming}
            />
            <Button
              type="button"
              onClick={() => void handleConfirmOtp()}
              disabled={isConfirming || confirmOtp.length < 6}
              className="w-full font-semibold shadow-xs"
            >
              {isConfirming ? 'Confirming...' : 'Confirm & Sign In'}
            </Button>
            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => {
                  setUnconfirmedEmail(null);
                  setConfirmOtp('');
                  setConfirmError(null);
                }}
                className="text-muted-foreground hover:text-foreground font-medium underline-offset-4 hover:underline"
              >
                Back to sign in
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await resendVerification(unconfirmedEmail);
                    toast.success('Confirmation code resent to your email.');
                  } catch {
                    toast.error('Failed to resend code. Please wait a minute.');
                  }
                }}
                className="text-primary font-semibold hover:underline flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Resend code</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md animate-fade-in">
      <Card className="auth-glass-card rounded-2xl">
        <CardHeader className="space-y-1 text-center pb-4">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Sign in to EquipSync
          </CardTitle>
          <CardDescription className="text-xs">
            Enter your credentials to access shared equipment and spaces
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">
                      Work / Institutional Email
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          aria-label="Work or Institutional Email"
                          className="pl-9 hover:border-primary/40 focus-visible:ring-1 transition-colors"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-xs font-semibold">
                        Password
                      </FormLabel>
                      <Link to="/forgot-password" className="text-[11px] text-primary hover:underline cursor-pointer">
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <PasswordInput
                        aria-label="Password"
                        className="hover:border-primary/40 focus-visible:ring-1 transition-colors"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isSubmitting} className="w-full gap-2 font-semibold shadow-sm mt-2 hover:-translate-y-px active:scale-[0.98] transition-all">
                <span>{isSubmitting ? 'Signing in...' : 'Continue to Dashboard'}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </Form>
        </CardContent>

        <CardFooter className="flex flex-col space-y-2 border-t border-border/60 pt-4 text-center text-xs text-muted-foreground">
          <div>
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-primary hover:underline">
              Create an account
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
