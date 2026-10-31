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
import { signUpMember, signUpInstitution, searchInstitutions, resendVerification, Institution } from '@/lib/auth';
import { toastError } from '@/lib/errors';
import { toast } from 'sonner';
import { Mail, RefreshCw } from 'lucide-react';

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
  const { setRole } = useAuth();
  const navigate = useNavigate();
  const [selectedInstObj, setSelectedInstObj] = useState<Institution | null>(null);
  const [institutionError, setInstitutionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountType, setAccountType] = useState<'member' | 'institution_admin'>('member');
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

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

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      setIsSubmitting(true);
      let res: { user?: unknown; session?: unknown } | null = null;
      if (accountType === 'institution_admin') {
        res = await signUpInstitution({
          email: values.email,
          password: values.password,
          fullName: values.fullName,
          institutionName: values.institutionName || 'My Organisation Hub',
          institutionType: values.institutionType || 'University',
        }) as { user?: unknown; session?: unknown };
      } else {
        if (!selectedInstObj) {
          setInstitutionError('Please select an organisation from the list');
          toast.error('Please select an organisation from the suggestions list.');
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
      toast.success('Verification link resent. Please check your inbox.');
      setResendCooldown(60);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('limit')) {
        toast.error('Too many emails requested. Please wait a few minutes.');
      } else {
        toastError(err, 'Failed to resend verification email');
      }
    } finally {
      setIsResending(false);
    }
  };

  if (registeredEmail) {
    return (
      <div className="w-full max-w-md animate-fade-in">
        <Card className="surface border-border/80 shadow-xl text-center">
          <CardHeader className="space-y-2 pb-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2">
              <Mail className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              Verify Your Email
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed max-w-xs mx-auto">
              We have sent a verification link to <strong className="text-foreground">{registeredEmail}</strong>. Please click the link to activate your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <Button
              variant="outline"
              disabled={resendCooldown > 0 || isResending}
              onClick={handleResend}
              className="w-full gap-2 text-xs font-semibold"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isResending ? 'animate-spin' : ''}`} />
              <span>
                {resendCooldown > 0
                  ? `Resend Verification Email (${resendCooldown}s)`
                  : isResending
                  ? 'Resending...'
                  : 'Resend Verification Email'}
              </span>
            </Button>
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
      <Card className="surface border-border/80 shadow-xl backdrop-blur-md bg-card/85 rounded-2xl">
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
              <span>Organisation Admin</span>
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

                  <div>
                    <FormLabel className="text-xs font-semibold block mb-1">Organisation Affiliation</FormLabel>
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
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="institutionName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Organisation Name</FormLabel>
                        <FormControl>
                          <Input aria-label="Organisation Name" className="hover:border-primary/40 focus-visible:ring-1 transition-colors" {...field} />
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
                        <FormLabel className="text-xs font-semibold">Organisation Type</FormLabel>
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
