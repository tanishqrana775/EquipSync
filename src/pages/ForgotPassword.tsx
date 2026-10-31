/**
 * src/pages/ForgotPassword.tsx
 * EquipSync – Password recovery request form.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, KeyRound } from 'lucide-react';
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
import { sendPasswordReset } from '@/lib/auth';
import { toast } from 'sonner';

const forgotSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

export function ForgotPassword() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: ForgotFormValues) => {
    try {
      setIsSubmitting(true);
      await sendPasswordReset(values.email);
    } catch {
      // Always show neutral response regardless of error
    } finally {
      setIsSubmitting(false);
      setSubmitted(true);
      toast.info('If an account exists for that email, a reset link has been sent.');
    }
  };

  return (
    <div className="w-full max-w-md animate-fade-in">
      <Card className="surface border-border/80 shadow-xl backdrop-blur-md bg-card/85 rounded-2xl">
        <CardHeader className="space-y-1 text-center pb-4">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Reset Password
          </CardTitle>
          <CardDescription className="text-xs">
            Enter your email and we will send you a recovery link
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {submitted ? (
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-xs text-foreground space-y-2 text-center">
              <p className="font-semibold">Check your email</p>
              <p className="text-muted-foreground leading-relaxed">
                If an account exists for that email, a reset link has been sent. Please follow the link in your email to set a new password.
              </p>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Work / Institutional Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input aria-label="Work or Institutional Email" className="pl-9 hover:border-primary/40 focus-visible:ring-1 transition-colors" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={isSubmitting} className="w-full font-semibold shadow-sm mt-2 hover:-translate-y-px active:scale-[0.98] transition-all">
                  <span>{isSubmitting ? 'Sending Link...' : 'Send Recovery Link'}</span>
                </Button>
              </form>
            </Form>
          )}
        </CardContent>

        <CardFooter className="border-t border-border/60 pt-4 text-center justify-center text-xs text-muted-foreground">
          <Link to="/login" className="flex items-center gap-1 font-semibold text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Sign In</span>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
