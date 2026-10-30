import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, UserPlus, Building2, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { signUpMember, signUpInstitution, listInstitutions, Institution } from '@/lib/auth';
import { toastError } from '@/lib/errors';
import { toast } from 'sonner';

const registerSchema = z.object({
  accountType: z.enum(['member', 'institution_admin']),
  fullName: z.string().min(2, 'Full name is required'),
  campusId: z.string().optional(),
  department: z.string().optional(),
  email: z.string().email('Please enter a valid university email'),
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
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountType, setAccountType] = useState<'member' | 'institution_admin'>('member');

  useEffect(() => {
    let mounted = true;
    void listInstitutions()
      .then((data) => {
        if (mounted && data) {
          const valid = data.filter((d): d is Institution & { id: string } => typeof d.id === 'string');
          setInstitutions(valid);
          if (valid.length > 0 && !form.getValues('institutionId')) {
            form.setValue('institutionId', valid[0].id);
          }
        }
      })
      .catch(() => {
        // Safe silent catch on load
      });
    return () => {
      mounted = false;
    };
  }, []);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      accountType: 'member',
      fullName: 'Sarah Chen',
      campusId: 'STU-49102',
      department: 'School of Design & Robotics',
      email: 'sarah.chen@student.stanford.edu',
      password: 'password123',
      userType: 'student',
      institutionId: '',
      institutionName: 'Stanford Institute of Technology',
      institutionType: 'university',
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    if (import.meta.env.VITE_USE_MOCKS === 'true') {
      setRole(accountType === 'institution_admin' ? 'institution' : 'user');
      navigate(accountType === 'institution_admin' ? '/app/institution' : '/app/user');
      return;
    }

    try {
      setIsSubmitting(true);
      if (accountType === 'institution_admin') {
        await signUpInstitution({
          email: values.email,
          password: values.password,
          fullName: values.fullName,
          institutionName: values.institutionName || 'My Campus Hub',
          institutionType: values.institutionType || 'university',
        });
        toast.success('Institution created successfully! Please sign in.');
        navigate('/login');
      } else {
        const instId = values.institutionId || institutions[0]?.id;
        if (!instId) {
          toast.error('Please select an institution or register a new one.');
          return;
        }
        await signUpMember({
          email: values.email,
          password: values.password,
          fullName: values.fullName,
          userType: values.userType,
          institutionId: instId,
        });
        toast.success('Registration submitted! Your account is pending verification.');
        navigate('/login');
      }
    } catch (err) {
      toastError(err, 'Failed to complete registration. Please check your information.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md animate-fade-in">
      <Card className="surface border-border/80 shadow-xl">
        <CardHeader className="space-y-1 text-center pb-4">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-2">
            <UserPlus className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Create Campus Account
          </CardTitle>
          <CardDescription className="text-xs">
            Join the verified campus resource sharing directory
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
              <span>Campus Member</span>
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
              <span>Institution Admin</span>
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
                      <Input placeholder="e.g. Sarah Chen" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {accountType === 'member' ? (
                <>
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
                              <option value="staff">Faculty / Staff</option>
                              <option value="external">External Affiliate</option>
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="institutionId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">Institution</FormLabel>
                          <FormControl>
                            <select
                              {...field}
                              value={field.value ?? ''}
                              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring truncate"
                            >
                              {institutions.length === 0 ? (
                                <option value="">Loading institutions...</option>
                              ) : (
                                institutions.map((inst) => (
                                  <option key={inst.id} value={inst.id ?? ''}>
                                    {inst.name}
                                  </option>
                                ))
                              )}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="campusId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">Campus ID</FormLabel>
                          <FormControl>
                            <Input placeholder="STU-1234" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="department"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">Department</FormLabel>
                          <FormControl>
                            <Input placeholder="Engineering" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="institutionName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Institution Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Riverside Tech" {...field} />
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
                        <FormLabel className="text-xs font-semibold">Institution Type</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. University" {...field} />
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
                    <FormLabel className="text-xs font-semibold">Campus Email</FormLabel>
                    <FormControl>
                      <Input placeholder="name@university.edu" {...field} />
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
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-2">
                <Button type="submit" disabled={isSubmitting} className="w-full gap-2 font-semibold shadow-sm">
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
