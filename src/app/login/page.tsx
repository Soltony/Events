
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { Loader2, ArrowRight, Phone, Lock, ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';

const loginFormSchema = z.object({
  phoneNumber: z.string().min(1, { message: 'Phone number is required.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 30;

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (lockoutUntil) {
        const updateCountdown = () => {
            const remaining = Math.max(0, Math.ceil((lockoutUntil.getTime() - Date.now()) / 1000));
            setCountdown(remaining);
            if (remaining === 0) {
                setLockoutUntil(null);
                setFailedAttempts(0);
                clearInterval(interval);
            }
        };
        updateCountdown();
        interval = setInterval(updateCountdown, 1000);
    }
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      phoneNumber: '',
      password: '',
    },
  });

  const handleLogin = async (data: LoginFormValues) => {
    if (lockoutUntil && new Date() < lockoutUntil) {
      toast({
        variant: 'destructive',
        title: 'Too many attempts',
        description: `Please wait ${countdown} seconds before trying again.`,
      });
      return;
    }

    setIsSubmitting(true);
    const success = await login(data);
    setIsSubmitting(false);

    if (!success) {
      const newAttemptCount = failedAttempts + 1;
      setFailedAttempts(newAttemptCount);
      if (newAttemptCount >= MAX_LOGIN_ATTEMPTS) {
        const lockoutTime = new Date(Date.now() + LOCKOUT_DURATION_SECONDS * 1000);
        setLockoutUntil(lockoutTime);
        toast({
          variant: 'destructive',
          title: 'Login Locked',
          description: `Too many failed attempts. Please wait ${LOCKOUT_DURATION_SECONDS} seconds.`,
        });
      } else {
        toast({
            variant: 'destructive',
            title: 'Login Failed',
            description: `Invalid credentials. You have ${MAX_LOGIN_ATTEMPTS - newAttemptCount} attempts remaining.`
        });
      }
    } else {
        setFailedAttempts(0);
    }
  };

  const isLockedOut = !!lockoutUntil;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background p-4">
       <Button asChild variant="ghost" className="absolute top-4 left-4">
        <Link href="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Homepage
        </Link>
      </Button>
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="items-center text-center pt-8 pb-4">
            <Image
                src="/images/nibtickets.jpg"
                alt="NibTera Tickets Logo"
                width={200}
                height={60}
                className="object-contain"
                data-ai-hint="logo nibtera" 
                priority
            />
             <h2 className="text-xl font-semibold text-[#8B5E34] pt-2">
                Login
            </h2>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-6">
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        Phone Number
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., 0912345678" 
                        {...field} 
                        className="bg-transparent text-base border-0 border-b rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1"
                        disabled={isLockedOut}
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
                    <FormLabel className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                        <Lock className="h-4 w-4" />
                        Password
                    </FormLabel>
                    <FormControl>
                      <PasswordInput {...field} className="bg-transparent text-base border-0 border-b rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1" disabled={isLockedOut} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full h-12 text-base font-bold" disabled={isLoading || isSubmitting || isLockedOut}>
                {isLockedOut ? (
                    `Try again in ${countdown}s`
                ) : (isLoading || isSubmitting) ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                    <>
                        <ArrowRight className="mr-2 h-5 w-5" />
                        Sign In
                    </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
