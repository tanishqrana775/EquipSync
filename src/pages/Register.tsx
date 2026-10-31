/**
 * src/pages/Register.tsx
 * EquipSync - Enterprise Multi-Tenant Registration & Onboarding.
 * Features:
 * 1. 3-Step Wizard for Organization Admins (Organization -> Administrator -> Review).
 * 2. Live organization name availability check via RPC organization_name_available.
 * 3. Live domain alignment comparison with website URL (Verified domain badge hint).
 * 4. Member registration with auto-match organization recognition.
 * 5. Robust 6-digit OTP verification gate with friendly inline error mapping.
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/shared/PasswordInput';
import { PasswordStrength } from '@/components/shared/PasswordStrength';
import { InstitutionSearchAutocomplete } from '@/components/shared/InstitutionSearchAutocomplete';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/providers/AuthProvider';
import {
  signUpMember,
  signUpInstitution,
  resendVerification,
  verifySignUpOtp,
  checkOrganizationNameAvailable,
  Institution,
} from '@/lib/auth';
import { matchOrganizationByEmail } from '@/lib/api/rpc';
import { supabase } from '@/lib/supabase';
import { toastError } from '@/lib/errors';
import { toast } from 'sonner';
import {
  Mail,
  RefreshCw,
  CheckCircle2,
  Lock,
  Building2,
  GraduationCap,
  Globe,
  Phone,
  Briefcase,
  FileText,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Edit2,
  ShieldCheck,
} from 'lucide-react';
import { OtpInput } from '@/components/shared/OtpInput';

// -----------------------------------------------------------------------------
// Form Schema & Validation
// -----------------------------------------------------------------------------
const registerSchema = z
  .object({
    accountType: z.enum(['member', 'institution_admin']),
    // Common fields
    fullName: z.string().min(2, 'Full name is required (at least 2 characters)'),
    email: z.string().email('Please enter a valid work or institutional email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    // Member specific
    campusId: z.string().optional(),
    department: z.string().optional(),
    userType: z.enum(['student', 'staff', 'external']).default('student'),
    institutionId: z.string().optional(),
    // Organization Admin specific
    institutionName: z.string().optional(),
    institutionType: z.string().default('University'),
    websiteUrl: z.string().optional(),
    contactPhone: z.string().optional(),
    registrationId: z.string().optional(),
    jobTitle: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.accountType === 'institution_admin') {
      const name = (data.institutionName || '').trim();
      if (name.length < 3 || name.length > 120) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['institutionName'],
          message: 'Organization name must be between 3 and 120 characters',
        });
      }

      const web = (data.websiteUrl || '').trim();
      const webPattern = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/;
      if (!web || !webPattern.test(web)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['websiteUrl'],
          message: 'Please enter a valid official website URL (e.g. https://example.edu)',
        });
      }

      const phone = (data.contactPhone || '').trim();
      const phonePattern = /^\+?[0-9 ()-]{7,20}$/;
      if (!phone || !phonePattern.test(phone)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['contactPhone'],
          message: 'Please enter a valid contact phone number (7 to 20 digits)',
        });
      }

      const title = (data.jobTitle || '').trim();
      if (title.length < 2 || title.length > 80) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['jobTitle'],
          message: 'Official title must be between 2 and 80 characters',
        });
      }

      const regId = (data.registrationId || '').trim();
      if (regId.length > 0) {
        if (regId.length > 40 || !/^[a-zA-Z0-9 -/.]+$/.test(regId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['registrationId'],
            message: 'Registration ID must be at most 40 characters of letters, digits, spaces, and -/.',
          });
        }
      }
    }
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export function Register() {
  const { refresh } = useAuth();
  const navigate = useNavigate();

  const [accountType, setAccountType] = useState<'member' | 'institution_admin'>('member');
  const [adminWizardStep, setAdminWizardStep] = useState<1 | 2 | 3>(1);
  const [selectedInstObj, setSelectedInstObj] = useState<Institution | null>(null);
  const [institutionError, setInstitutionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live organization name availability state
  const [nameAvailability, setNameAvailability] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  // OTP Email Confirmation state
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
    mode: 'onChange',
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
      websiteUrl: '',
      contactPhone: '',
      registrationId: '',
      jobTitle: '',
    },
  });

  const watchedEmail = form.watch('email');
  const watchedOrgName = form.watch('institutionName');
  const watchedWebsite = form.watch('websiteUrl');

  // 1. Live Member Email Matching (Auto-recognition)
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

  // 2. Live Admin Organization Name Availability Check
  useEffect(() => {
    if (accountType !== 'institution_admin' || !watchedOrgName || watchedOrgName.trim().length < 3) {
      setNameAvailability('idle');
      return;
    }

    setNameAvailability('checking');
    const timer = setTimeout(async () => {
      const isAvailable = await checkOrganizationNameAvailable(watchedOrgName);
      setNameAvailability(isAvailable ? 'available' : 'taken');
    }, 400);

    return () => clearTimeout(timer);
  }, [watchedOrgName, accountType]);

  // 3. Live Domain Alignment Hint for Organization Admin
  const domainHint = useMemo(() => {
    if (!watchedWebsite || !watchedEmail || !watchedEmail.includes('@')) {
      return null;
    }
    const emailDomain = watchedEmail.split('@')[1]?.toLowerCase().trim();
    let cleanWeb = watchedWebsite.trim().toLowerCase();
    cleanWeb = cleanWeb.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];

    if (!emailDomain || !cleanWeb) return null;

    const isMatch =
      emailDomain === cleanWeb ||
      emailDomain.endsWith('.' + cleanWeb) ||
      cleanWeb.endsWith('.' + emailDomain);

    return isMatch
      ? {
          matches: true,
          text: 'Your email matches your website. After you confirm your email your organization gets a Verified domain badge.',
        }
      : {
          matches: false,
          text: "Use an email on your organization's domain to earn the Verified domain badge. You can continue without it.",
        };
  }, [watchedWebsite, watchedEmail]);

  // Step Navigators for Admin Wizard
  const handleNextToAdmin = async () => {
    const valid = await form.trigger([
      'institutionName',
      'institutionType',
      'websiteUrl',
      'contactPhone',
      'registrationId',
    ]);
    if (valid && nameAvailability !== 'taken') {
      setAdminWizardStep(2);
    }
  };

  const handleNextToReview = async () => {
    const valid = await form.trigger(['fullName', 'jobTitle', 'email', 'password']);
    if (valid) {
      setAdminWizardStep(3);
    }
  };

  // ---------------------------------------------------------------------------
  // Submit Handler
  // ---------------------------------------------------------------------------
  const onSubmit = async (values: RegisterFormValues) => {
    try {
      setIsSubmitting(true);
      let res: { user?: unknown; session?: unknown } | null = null;

      if (accountType === 'institution_admin') {
        // Normalize website URL with https:// prefix
        let normalizedWebsite = (values.websiteUrl || '').trim();
        if (!normalizedWebsite.startsWith('http://') && !normalizedWebsite.startsWith('https://')) {
          normalizedWebsite = 'https://' + normalizedWebsite;
        } else if (normalizedWebsite.startsWith('http://')) {
          normalizedWebsite = 'https://' + normalizedWebsite.slice(7);
        }

        res = (await signUpInstitution({
          email: values.email,
          password: values.password,
          fullName: values.fullName,
          institutionName: values.institutionName || 'My Organization Hub',
          institutionType: values.institutionType || 'University',
          websiteUrl: normalizedWebsite,
          contactPhone: (values.contactPhone || '').trim(),
          registrationId: values.registrationId?.trim() || undefined,
          jobTitle: (values.jobTitle || '').trim(),
        })) as { user?: unknown; session?: unknown };
      } else {
        if (!selectedInstObj) {
          setInstitutionError('Please select an organization from the suggestions list');
          toast.error('Please select an organization from the suggestions list.');
          return;
        }
        res = (await signUpMember({
          email: values.email,
          password: values.password,
          fullName: values.fullName,
          userType: values.userType,
          institutionId: selectedInstObj.id,
        })) as { user?: unknown; session?: unknown };
      }

      const candidateUser =
        res?.user && typeof res.user === 'object' ? (res.user as { identities?: unknown[] }) : null;
      if (
        candidateUser?.identities &&
        Array.isArray(candidateUser.identities) &&
        candidateUser.identities.length === 0
      ) {
        toast.error('An account with this email may already exist. Try signing in or resetting your password.');
        return;
      }

      if (!res?.session) {
        toast.success('Registration initiated. Please enter the 6-digit verification code sent to your email.');
        setRegisteredEmail(values.email);
        setResendCooldown(60);
        return;
      }

      toast.success('Registration completed successfully!');
      navigate(accountType === 'institution_admin' ? '/app/institution' : '/app/user', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('organization_exists')) {
        toast.error('An active organization with this name already exists. Please choose a different name.');
        setAdminWizardStep(1);
      } else if (msg.includes('invalid_website')) {
        toast.error('Invalid website URL. Please enter a valid URL.');
        setAdminWizardStep(1);
      } else if (msg.includes('invalid_phone')) {
        toast.error('Invalid contact phone number. Please enter 7-20 digits.');
        setAdminWizardStep(1);
      } else if (msg.includes('invalid_organization_type')) {
        toast.error('Please select a valid organization type.');
        setAdminWizardStep(1);
      } else if (msg.includes('invalid_job_title')) {
        toast.error('Official title must be between 2 and 80 characters.');
        setAdminWizardStep(2);
      } else if (msg.includes('invalid_registration_id')) {
        toast.error('Registration ID must be at most 40 characters of letters, digits, and -/.');
        setAdminWizardStep(1);
      } else {
        toastError(err, 'Failed to complete registration. Please check your information.');
      }
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

  // ---------------------------------------------------------------------------
  // View A: OTP Email Confirmation Modal/Card
  // ---------------------------------------------------------------------------
  if (registeredEmail) {
    return (
      <Card className="w-full max-w-md mx-auto shadow-xl border-border/80 bg-card/95 backdrop-blur-md animate-fade-in">
        <CardHeader className="space-y-2 text-center pb-4">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
            <Mail className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">Confirm Your Account</CardTitle>
          <CardDescription className="text-xs text-muted-foreground leading-relaxed">
            We sent a 6-digit confirmation code to{' '}
            <span className="font-semibold text-foreground font-mono">{registeredEmail}</span>.
            Enter it below to activate your account.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="flex flex-col items-center justify-center py-2">
            <OtpInput
              value={otpCode}
              onChange={(val) => {
                setOtpCode(val);
                if (otpError) setOtpError(null);
              }}
              onComplete={(code) => {
                void handleVerifyOtp(code);
              }}
              error={otpError}
              autoFocus
            />
          </div>

          {otpError && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 animate-fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{otpError}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-muted-foreground">Didn&apos;t receive the code?</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResend}
              disabled={resendCooldown > 0 || isResending}
              className="text-xs h-8 px-2 font-semibold text-primary hover:text-primary/90"
            >
              {isResending ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Sending...
                </>
              ) : resendCooldown > 0 ? (
                `Resend in ${resendCooldown}s`
              ) : (
                'Resend Code'
              )}
            </Button>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-2 pt-2">
          <Button
            className="w-full font-semibold shadow-xs"
            onClick={() => handleVerifyOtp()}
            disabled={otpCode.length < 6 || isVerifying}
          >
            {isVerifying ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Verifying Account...
              </>
            ) : (
              'Confirm & Access Dashboard'
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRegisteredEmail(null);
              setOtpCode('');
              setOtpError(null);
            }}
            className="w-full text-xs text-muted-foreground hover:text-foreground"
          >
            Back to Registration
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // ---------------------------------------------------------------------------
  // View B: Registration Form (Member Form or 3-Step Organization Wizard)
  // ---------------------------------------------------------------------------
  return (
    <Card className="w-full max-w-xl mx-auto shadow-xl border-border/80 bg-card/95 backdrop-blur-md">
      <CardHeader className="space-y-1 text-center pb-4">
        <div className="mx-auto w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-1 shadow-xs">
          <Building2 className="h-5 w-5" />
        </div>
        <CardTitle className="text-xl font-bold tracking-tight">Create EquipSync Account</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Join the verified equipment and space sharing network
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Account Role Selector Tabs */}
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

        {/* ----------------------------------------------------------------- */}
        {/* ORGANIZATION ADMIN 3-STEP WIZARD PROGRESS BAR                     */}
        {/* ----------------------------------------------------------------- */}
        {accountType === 'institution_admin' && (
          <div className="py-2 space-y-2 border-b border-border/60">
            <div className="flex items-center justify-between text-xs font-semibold px-1">
              <span className={adminWizardStep >= 1 ? 'text-primary font-bold' : 'text-muted-foreground'}>
                1. Organization
              </span>
              <span className={adminWizardStep >= 2 ? 'text-primary font-bold' : 'text-muted-foreground'}>
                2. Administrator
              </span>
              <span className={adminWizardStep >= 3 ? 'text-primary font-bold' : 'text-muted-foreground'}>
                3. Review
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  adminWizardStep >= 1 ? 'bg-primary' : 'bg-transparent'
                }`}
              />
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  adminWizardStep >= 2 ? 'bg-primary' : 'bg-transparent'
                }`}
              />
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  adminWizardStep >= 3 ? 'bg-primary' : 'bg-transparent'
                }`}
              />
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* ============================================================= */}
            {/* MODE 1: MEMBER REGISTRATION FORM                              */}
            {/* ============================================================= */}
            {accountType === 'member' && (
              <div className="space-y-3.5">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Full Name</FormLabel>
                      <FormControl>
                        <Input
                          aria-label="Full Name"
                          placeholder="e.g. Jane Doe"
                          className="hover:border-primary/40 focus-visible:ring-1 transition-colors text-xs"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                          <Input aria-label="Member ID" placeholder="e.g. STU-2024" className="text-xs" {...field} />
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
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                      <div className="space-y-0.5 flex-1">
                        <span className="font-bold block">Recognized: {matchedOrg.name}</span>
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
                      <Lock className="h-3.5 w-3.5 text-muted-foreground absolute right-3 top-3" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold">Organization Affiliation</FormLabel>
                    <InstitutionSearchAutocomplete
                      selectedInstitution={selectedInstObj}
                      onSelect={(inst) => {
                        setSelectedInstObj(inst);
                        form.setValue('institutionId', inst ? inst.id : '');
                        setInstitutionError(null);
                      }}
                      error={institutionError}
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
                        <Input
                          aria-label="Email Address"
                          type="email"
                          placeholder="name@university.edu"
                          className="hover:border-primary/40 focus-visible:ring-1 transition-colors text-xs"
                          {...field}
                        />
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
                      <FormLabel className="text-xs font-semibold">Password</FormLabel>
                      <FormControl>
                        <PasswordInput aria-label="Password" placeholder="At least 6 characters" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={isSubmitting} className="w-full font-semibold shadow-xs mt-2">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating Account...
                    </>
                  ) : (
                    'Register & Open Dashboard'
                  )}
                </Button>
              </div>
            )}

            {/* ============================================================= */}
            {/* MODE 2: ORGANIZATION ADMIN 3-STEP WIZARD                     */}
            {/* ============================================================= */}
            {accountType === 'institution_admin' && (
              <div className="space-y-4">
                {/* --------------------------------------------------------- */}
                {/* STEP 1: ORGANIZATION PROFILE                              */}
                {/* --------------------------------------------------------- */}
                {adminWizardStep === 1 && (
                  <div className="space-y-3.5 animate-fade-in">
                    <FormField
                      control={form.control}
                      name="institutionName"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-xs font-semibold">Organization Name</FormLabel>
                            {nameAvailability === 'checking' && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" /> Checking...
                              </span>
                            )}
                            {nameAvailability === 'available' && (
                              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Name available
                              </span>
                            )}
                            {nameAvailability === 'taken' && (
                              <span className="text-[11px] font-semibold text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Name already registered
                              </span>
                            )}
                          </div>
                          <FormControl>
                            <Input
                              aria-label="Organization Name"
                              placeholder="e.g. Stanford Equipment Hub"
                              className="text-xs"
                              {...field}
                            />
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
                              <option value="School">School</option>
                              <option value="Corporate">Corporate</option>
                              <option value="Makerspace">Makerspace</option>
                              <option value="Workshop">Workshop</option>
                              <option value="Shop">Shop</option>
                              <option value="Community lab">Community lab</option>
                              <option value="Research institute">Research institute</option>
                              <option value="Other">Other</option>
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="websiteUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                            <Globe className="h-3.5 w-3.5 text-primary" />
                            <span>Official Website URL</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              aria-label="Official Website URL"
                              placeholder="https://example.edu"
                              className="text-xs font-mono"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="contactPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 text-primary" />
                              <span>Contact Phone</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                aria-label="Contact Phone"
                                placeholder="+1 (555) 019-2834"
                                className="text-xs"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="registrationId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>Registration / Tax ID (Optional)</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                aria-label="Registration ID"
                                placeholder="e.g. REG-2024-889"
                                className="text-xs font-mono"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="pt-2 flex justify-end">
                      <Button
                        type="button"
                        onClick={handleNextToAdmin}
                        disabled={nameAvailability === 'taken'}
                        className="font-semibold text-xs gap-1.5 shadow-xs"
                      >
                        <span>Continue to Administrator Details</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* --------------------------------------------------------- */}
                {/* STEP 2: ADMINISTRATOR CREDENTIALS                         */}
                {/* --------------------------------------------------------- */}
                {adminWizardStep === 2 && (
                  <div className="space-y-3.5 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold">Administrator Full Name</FormLabel>
                            <FormControl>
                              <Input
                                aria-label="Administrator Full Name"
                                placeholder="e.g. Alex Rivera"
                                className="text-xs"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="jobTitle"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                              <Briefcase className="h-3.5 w-3.5 text-primary" />
                              <span>Official Title / Role</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                aria-label="Official Title"
                                placeholder="e.g. Facility Director or Lab Manager"
                                className="text-xs"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">Work / Official Email Address</FormLabel>
                          <FormControl>
                            <Input
                              aria-label="Email Address"
                              type="email"
                              placeholder="admin@example.edu"
                              className="text-xs"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Live Domain Alignment Hint */}
                    {domainHint && (
                      <div
                        className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-fade-in ${
                          domainHint.matches
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {domainHint.matches ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                        )}
                        <span className="leading-relaxed">{domainHint.text}</span>
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-xs font-semibold">Administrator Password</FormLabel>
                          <FormControl>
                            <PasswordInput aria-label="Password" placeholder="At least 6 characters" {...field} />
                          </FormControl>
                          <PasswordStrength password={field.value} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="pt-2 flex items-center justify-between">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAdminWizardStep(1)}
                        className="text-xs gap-1.5"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        <span>Back</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleNextToReview}
                        className="text-xs gap-1.5 font-semibold shadow-xs"
                      >
                        <span>Review & Confirm</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* --------------------------------------------------------- */}
                {/* STEP 3: REVIEW & SUMMARY                                  */}
                {/* --------------------------------------------------------- */}
                {adminWizardStep === 3 && (
                  <div className="space-y-4 animate-fade-in">
                    {/* Organization Summary Box */}
                    <div className="surface p-4 rounded-xl border border-border/80 space-y-2.5">
                      <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                          <Building2 className="h-4 w-4 text-primary" />
                          <span>Organization Profile</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setAdminWizardStep(1)}
                          className="h-7 px-2 text-[11px] text-primary hover:text-primary/90 font-semibold gap-1"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span>Edit</span>
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">Name</span>
                          <span className="font-semibold text-foreground">{form.getValues('institutionName')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">Type</span>
                          <span className="font-semibold text-foreground">{form.getValues('institutionType')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">Website</span>
                          <span className="font-mono text-muted-foreground truncate block">
                            {form.getValues('websiteUrl')}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">Phone</span>
                          <span className="font-mono text-muted-foreground">{form.getValues('contactPhone')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Administrator Summary Box */}
                    <div className="surface p-4 rounded-xl border border-border/80 space-y-2.5">
                      <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                          <Briefcase className="h-4 w-4 text-primary" />
                          <span>Administrator Credentials</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setAdminWizardStep(2)}
                          className="h-7 px-2 text-[11px] text-primary hover:text-primary/90 font-semibold gap-1"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span>Edit</span>
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">Full Name</span>
                          <span className="font-semibold text-foreground">{form.getValues('fullName')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">Title</span>
                          <span className="font-semibold text-foreground">{form.getValues('jobTitle')}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">Work Email</span>
                          <span className="font-mono text-foreground">{form.getValues('email')}</span>
                        </div>
                      </div>

                      {/* Domain Badge Status Preview */}
                      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium">Domain Trust Level:</span>
                        {domainHint?.matches ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold">
                            <ShieldCheck className="h-3 w-3 mr-1" /> Verified Domain (Auto-proved)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Self-Declared Organization
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Next Steps Explanation */}
                    <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground space-y-1">
                      <span className="font-bold text-foreground block">What happens next:</span>
                      <ol className="list-decimal pl-4 space-y-1 text-[11px] leading-relaxed">
                        <li>You&apos;ll confirm your work email with a 6-digit one-time passcode.</li>
                        <li>Upon confirmation, your organization workspace activates immediately.</li>
                        <li>You can begin cataloging assets and managing borrowing permissions.</li>
                      </ol>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAdminWizardStep(2)}
                        className="text-xs gap-1.5"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        <span>Back</span>
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="text-xs font-semibold shadow-xs gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Creating Workspace...</span>
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4" />
                            <span>Register & Open Dashboard</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>
        </Form>
      </CardContent>

      <CardFooter className="flex justify-center border-t border-border/60 py-4">
        <p className="text-xs text-muted-foreground">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign In
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

export default Register;
