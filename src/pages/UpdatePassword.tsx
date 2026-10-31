/**
 * src/pages/UpdatePassword.tsx
 * EquipSync – Password recovery and update page.
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, AlertCircle } from 'lucide-react';
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
import { supabase } from '@/lib/supabase';
import { updatePassword, signOut } from '@/lib/auth';
import { toastError } from '@/lib/errors';
import { toast } from 'sonner';

const updatePasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type UpdatePasswordValues = z.infer<typeof updatePasswordSchema>;

export function UpdatePassword() {
  const navigate = useNavigate();
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Check if a recovery session is already loaded
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setHasRecoverySession(true);
      }
    });

    // Listen to PASSWORD_RECOVERY event from recovery email link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && hasRecoverySession === null)) {
        setHasRecoverySession(true);
      }
    });

    // Safety timeout: if after 1.5 seconds no session is verified, mark as expired
    const timer = setTimeout(() => {
      setHasRecoverySession((prev) => (prev === null ? false : prev));
    }, 1500);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [hasRecoverySession]);

  const form = useForm<UpdatePasswordValues>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (values: UpdatePasswordValues) => {
    try {
      setIsSubmitting(true);
      await updatePassword(values.password);
      toast.success('Password updated successfully! Please sign in with your new credentials.');
      await signOut();
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      toastError(err, 'Failed to update password');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (hasRecoverySession === false) {
    return (
      <div className="w-full max-w-md animate-fade-in">
        <Card className="surface border-border/80 shadow-xl text-center">
          <CardHeader className="space-y-2 pb-4">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive mb-2">
              <AlertCircle className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold tracking-tight">
              Recovery Link Expired
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed max-w-xs mx-auto">
              This password recovery link is expired, invalid, or already used. Please request a new link.
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-2 justify-center">
            <Link to="/forgot-password">
              <Button size="sm" className="font-semibold">
                Request New Reset Link
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md animate-fade-in">
      <Card className="surface border-border/80 shadow-xl">
        <CardHeader className="space-y-1 text-center pb-4">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
            <Lock className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Create New Password
          </CardTitle>
          <CardDescription className="text-xs">
            Choose a strong password of at least 8 characters
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isSubmitting} className="w-full font-semibold shadow-sm mt-2">
                <span>{isSubmitting ? 'Updating...' : 'Save Password & Sign In'}</span>
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
