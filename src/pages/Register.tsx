import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, UserPlus, Building2, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/shared/PasswordInput';
import { InstitutionSearchAutocomplete } from '@/components/shared/InstitutionSearchAutocomplete';
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
import { signUpMember, signUpInstitution, searchInstitutions, resendVerification, verifySignUpOtp, Institution } from '@/lib/auth';
import { matchOrganizationByEmail } from '@/lib/api/rpc';
import { supabase } from '@/lib/supabase';
import { toastError } from '@/lib/errors';
import { toast } from 'sonner';
import { Mail, RefreshCw, CheckCircle2, Lock } from 'lucide-react';
import { OtpInput } from '@/components/shared/OtpInput';
const registerSchema = z.object({
  accountType: z.enum(['member', 'institution_admin']),
  fullName: z.string().min(2, 'Full name is required'),
  campusId: z.string().optional(),
  department: z.string().optional(),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  userType: z.enum(['student', 'staff', 'external']).default('student'),
  institutionId: z.string().optional(),
  institutionName: z.string().optional(),
  institutionType: z.string().default('university'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function Register() {
  const { setRole, refresh } = useAuth();
  const navigate = useNavigate();
  const [selectedInstObj, setSelectedInstObj] = useState<Institution | null>(null);
  const [institutionError, setInstitutionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountType, setAccountType] = useState<'member' | 'institution_admin'>('member');
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [matchedOrg, setMatchedOrg] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);


  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      accountType: 'member',
      fullName: '',
      campusId: '',
      department: '',
      email: '',
      password: '',
      userType: 'student',
      institutionId: '',
      institutionName: '',
      institutionType: 'University',
    },
  });
  const watchedEmail = form.watch('email');
  useEffect(() => {
    if (accountType !== 'member' || !watchedEmail || !watchedEmail.includes('@')) {
      setMatchedOrg(null);
      return;
    }

    const timer = setTimeout(async () => {
      const org = await matchOrganizationByEmail(watchedEmail);
      if (org) {
        setMatchedOrg(org);
        setSelectedInstObj({ id: org.id, name: org.name, type: 'University' });
        form.setValue('institutionId', org.id);
        setInstitutionError(null);
      } else {
        setMatchedOrg(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [watchedEmail, accountType, form]);

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      setIsSubmitting(true);
      let res: { user?: unknown; session?: unknown } | null = null;
      if (accountType === 'institution_admin') {
        res = await signUpInstitution({
          email: values.email,
          password: values.password,
          fullName: values.fullName,
          institutionName: values.institutionName || 'My Organization Hub',
          institutionType: values.institutionType || 'University',
        }) as { user?: unknown; session?: unknown };
      } else {
        if (!selectedInstObj) {
          setInstitutionError('Please select an organization from the list');
          toast.error('Please select an organization from the suggestions list.');
          return;
        }
        res = await signUpMember({
          email: values.email,
          password: values.password,
          fullName: values.fullName,
          userType: values.userType,
          institutionId: selectedInstObj.id,
        }) as { user?: unknown; session?: unknown };
      }

      const candidateUser = res?.user && typeof res.user === 'object' ? (res.user as { identities?: unknown[] }) : null;
      if (candidateUser?.identities && Array.isArray(candidateUser.identities) && candidateUser.identities.length === 0) {
        toast.error('An account with this email may already exist. Try signing in or resetting your password.');
        return;
      }

      if (!res?.session) {
        toast.success('Registration successful. Please check your email to verify your account.');
        setRegisteredEmail(values.email);
        setResendCooldown(60);
        return;
      }

      toast.success('Registration completed successfully!');
      navigate(accountType === 'institution_admin' ? '/app/institution' : '/app/user', { replace: true });
    } catch (err: unknown) {
      toastError(err, 'Failed to complete registration. Please check your information.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!registeredEmail || resendCooldown > 0) return;
    try {
      setIsResending(true);
      await resendVerification(registeredEmail);
      toast.success('Verification code resent. Please check your inbox.');
      setResendCooldown(60);
      setOtpError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('limit')) {
        toast.error('Too many requests. Please wait a few minutes.');
      } else {
        toastError(err, 'Failed to resend confirmation email');
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    if (!registeredEmail) return;
    const code = codeToVerify || otpCode;
    if (code.length < 6) {
      setOtpError('Please enter all 6 digits of the confirmation code.');
      return;
    }

    try {
      setIsVerifying(true);
      setOtpError(null);
      await verifySignUpOtp(registeredEmail, code);
      await refresh();

      try {
        const { data: userRes } = await supabase.auth.getUser();
        if (userRes.user?.id) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('verification_method, institution_id, institutions(name)')
            .eq('id', userRes.user.id)
            .single();
          if (prof?.verification_method === 'domain') {
            const orgName = (prof.institutions as { name?: string })?.name || 'your organization';
            toast.success(`You were verified automatically for ${orgName}.`);
          } else {
            toast.success('Account confirmed successfully!');
          }
        } else {
          toast.success('Account confirmed successfully!');
        }
      } catch {
        toast.success('Account confirmed successfully!');
      }

      navigate(accountType === 'institution_admin' ? '/app/institution' : '/app/user', { replace: true });
    } catch (err: unknown) {
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);

      if (nextAttempts >= 5) {
        toast.error('Maximum verification attempts exceeded. Please try again.');
        setRegisteredEmail(null);
        setOtpCode('');
        setFailedAttempts(0);
        return;
      }

      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      if (msg.includes('expired')) {
        setOtpError('Verification code has expired. Please resend a new code.');
      } else {
        setOtpError(`Invalid code. ${5 - nextAttempts} attempt(s) remaining.`);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  if (registeredEmail) {
    const [local, domain] = registeredEmail.split('@');
    const masked = local.length <= 2 ? `${local[0]}*@${domain}` : `${local[0]}***${local[local.length - 1]}@${domain}`;

    return (
      <div className="w-full max-w-md animate-fade-in">
        <Card className="auth-glass-card rounded-2xl text-center">
          <CardHeader className="space-y-2 pb-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2 shadow-xs">
              <Mail className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              Confirm Your Account
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed max-w-xs mx-auto">
              We sent a 6-digit confirmation code to <strong className="text-foreground">{masked}</strong>. Enter it below to activate your account.
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
              disabled={isVerifying}
            />

            <Button
              type="button"
              onClick={() => void handleVerifyOtp()}
              disabled={isVerifying || otpCode.length < 6}
              className="w-full font-semibold shadow-xs"
            >
              {isVerifying ? 'Confirming...' : 'Confirm & Activate Account'}
            </Button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => {
                  setRegisteredEmail(null);
                  setOtpCode('');
                  setOtpError(null);
                }}
                className="text-muted-foreground hover:text-foreground font-medium underline-offset-4 hover:underline"
              >
                Change email
              </button>

              <button
                type="button"
                disabled={resendCooldown > 0 || isResending}
                onClick={handleResend}
                className={`font-semibold flex items-center gap-1 ${
                  resendCooldown > 0
                    ? 'text-muted-foreground cursor-not-allowed'
                    : 'text-primary hover:underline'
                }`}
              >
                <RefreshCw className={`h-3 w-3 ${isResending ? 'animate-spin' : ''}`} />
                <span>
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                </span>
              </button>
            </div>
          </CardContent>

          <CardFooter className="border-t border-border/60 pt-4 text-center justify-center text-xs text-muted-foreground">
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Back to Sign In
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }
  return (
    <div className="w-full max-w-md animate-fade-in">
      <Card className="auth-glass-card rounded-2xl">
        <CardHeader className="space-y-1 text-center pb-4">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-2">
            <UserPlus className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Create EquipSync Account
          </CardTitle>
          <CardDescription className="text-xs">
            Join the verified equipment and space sharing network
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Account Type Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted/60 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setAccountType('member');
                form.setValue('accountType', 'member');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                accountType === 'member'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              <span>Member Account</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAccountType('institution_admin');
                form.setValue('accountType', 'institution_admin');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                accountType === 'institution_admin'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Organization Admin</span>
            </button>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Full Name</FormLabel>
                    <FormControl>
                      <Input aria-label="Full Name" className="hover:border-primary/40 focus-visible:ring-1 transition-colors" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {accountType === 'member' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="userType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">Role Type</FormLabel>
                          <FormControl>
                            <select
                              {...field}
                              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                              <option value="student">Student</option>
                              <option value="staff">Staff / Faculty</option>
                              <option value="external">External Affiliate</option>
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="campusId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">Member / Staff ID</FormLabel>
                          <FormControl>
                            <Input aria-label="Member ID" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {matchedOrg ? (
                    <div className="space-y-2">
                      <FormLabel className="text-xs font-semibold block">Organization Affiliation</FormLabel>
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2 animate-fade-in">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block">
                            Recognized: {matchedOrg.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground block">
                            You&apos;ll be verified automatically after you confirm your email.
                          </span>
                        </div>
                      </div>
                      <div className="relative">
                        <Input
                          value={matchedOrg.name}
                          readOnly
                          disabled
                          className="bg-muted/60 text-xs font-semibold cursor-not-allowed pr-8"
                        />
                        <Lock className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <FormLabel className="text-xs font-semibold block mb-1">Organization Affiliation</FormLabel>
                      <InstitutionSearchAutocomplete
                        selectedInstitution={selectedInstObj}
                        onSelect={(inst) => {
                          setSelectedInstObj(inst);
                          setInstitutionError(null);
                          form.setValue('institutionId', inst ? inst.id : '');
                        }}
                        error={institutionError}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="institutionName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Organization Name</FormLabel>
                        <FormControl>
                          <Input aria-label="Organization Name" className="hover:border-primary/40 focus-visible:ring-1 transition-colors" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="institutionType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Organization Type</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <option value="University">University</option>
                            <option value="College">College</option>
                            <option value="Workshop">Workshop</option>
                            <option value="Shop">Shop</option>
                            <option value="Community lab">Community lab</option>
                            <option value="Other">Other</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Email Address</FormLabel>
                    <FormControl>
                      <Input aria-label="Email Address" className="hover:border-primary/40 focus-visible:ring-1 transition-colors" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Password</FormLabel>
                    <FormControl>
                      <PasswordInput aria-label="Password" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="pt-2">
                <Button type="submit" disabled={isSubmitting} className="w-full gap-2 font-semibold shadow-sm hover:-translate-y-px active:scale-[0.98] transition-all">
                  <span>{isSubmitting ? 'Registering...' : 'Register & Open Dashboard'}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>

        <CardFooter className="flex flex-col space-y-2 border-t border-border/60 pt-4 text-center text-xs text-muted-foreground">
          <div>
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Sign In
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
