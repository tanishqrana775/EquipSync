import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, GraduationCap, ArrowRight, ShieldCheck, Mail, Lock } from 'lucide-react';
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

const loginSchema = z.object({
  email: z.string().email('Please enter a valid campus email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function SignIn() {
  const { setRole } = useAuth();
  const navigate = useNavigate();
  const [selectedDemoRole, setSelectedDemoRole] = useState<'institution' | 'user'>('institution');

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'd.vance@stanford.edu',
      password: 'password123',
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    // In demo mode, sign in seamlessly using selected demo role
    setRole(selectedDemoRole);
    if (selectedDemoRole === 'institution') {
      navigate('/app/institution');
    } else {
      navigate('/app/user');
    }
  };

  const handleQuickDemoLaunch = (role: 'institution' | 'user') => {
    setRole(role);
    navigate(role === 'institution' ? '/app/institution' : '/app/user');
  };

  return (
    <div className="w-full max-w-md animate-fade-in">
      <Card className="surface border-border/80 shadow-xl">
        <CardHeader className="space-y-1 text-center pb-4">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Sign in to CampusShare
          </CardTitle>
          <CardDescription className="text-xs">
            Enter your university credentials or launch a one-click demo
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Quick Demo Access Switcher */}
          <div className="rounded-xl border border-border/80 bg-muted/40 p-3 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center">
              One-Click Demo Bypass
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={selectedDemoRole === 'institution' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setSelectedDemoRole('institution');
                  form.setValue('email', 'd.vance@stanford.edu');
                }}
                className="gap-1.5 text-xs h-9 font-medium"
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Institution Admin</span>
              </Button>
              <Button
                type="button"
                variant={selectedDemoRole === 'user' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setSelectedDemoRole('user');
                  form.setValue('email', 'sarah.chen@student.stanford.edu');
                }}
                className="gap-1.5 text-xs h-9 font-medium"
              >
                <GraduationCap className="h-3.5 w-3.5" />
                <span>Student / User</span>
              </Button>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">
                      Campus Email Address
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="name@university.edu"
                          className="pl-9"
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
                      <span className="text-[11px] text-primary hover:underline cursor-pointer">
                        Forgot?
                      </span>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="password"
                          placeholder="••••••••"
                          className="pl-9"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full gap-2 font-semibold shadow-sm mt-2">
                <span>Continue to Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </Form>
        </CardContent>

        <CardFooter className="flex flex-col space-y-2 border-t border-border/60 pt-4 text-center text-xs text-muted-foreground">
          <div>
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-primary hover:underline">
              Register with Student ID
            </Link>
          </div>
          <div className="text-[11px] text-muted-foreground/80">
            Phase 1 Prototype • Supabase Auth hook configured in lib/supabase.ts
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
