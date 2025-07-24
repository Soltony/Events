
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Loader2, ArrowRight, Phone, Lock, KeyRound, CheckCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { useToast } from '@/hooks/use-toast';
import { resetPassword } from '@/lib/actions';

const phoneSchema = z.object({
  phoneNumber: z.string().min(10, { message: 'Phone number must be at least 10 digits.' }),
});

const passwordSchema = z.object({
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

type PhoneFormValues = z.infer<typeof phoneSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  const phoneForm = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phoneNumber: '' },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const handlePhoneSubmit = async (data: PhoneFormValues) => {
    setIsLoading(true);
    // In a real app, you'd call an action to verify the phone number
    // and send an OTP. For this prototype, we'll just simulate success.
    setPhoneNumber(data.phoneNumber);
    setTimeout(() => {
        setStep(2);
        setIsLoading(false);
    }, 1000)
  };

  const handlePasswordSubmit = async (data: PasswordFormValues) => {
    setIsLoading(true);
    try {
        await resetPassword(phoneNumber, data.password);
        setStep(3);
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error.message || 'Failed to reset password. Please try again.',
        })
    } finally {
        setIsLoading(false);
    }
  };
  
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <>
            <CardHeader className="items-center text-center">
                <KeyRound className="h-12 w-12 text-primary mb-4" />
                <CardTitle className="text-2xl">Forgot Password?</CardTitle>
                <CardDescription>Enter your phone number to start the password reset process.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...phoneForm}>
                <form onSubmit={phoneForm.handleSubmit(handlePhoneSubmit)} className="space-y-6">
                  <FormField
                    control={phoneForm.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          Phone Number
                        </FormLabel>
                        <FormControl>
                           <Input placeholder="e.g., 0912345678" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full h-12 text-base font-bold" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><ArrowRight className="mr-2 h-5 w-5" /> Next</>}
                  </Button>
                </form>
              </Form>
              <div className="mt-4 text-center text-sm">
                <Link href="/login" className="font-semibold text-primary hover:underline">
                  Back to Login
                </Link>
              </div>
            </CardContent>
          </>
        );
      case 2:
        return (
          <>
             <CardHeader className="items-center text-center">
                <KeyRound className="h-12 w-12 text-primary mb-4" />
                <CardTitle className="text-2xl">Reset Your Password</CardTitle>
                <CardDescription>Enter a new password for {phoneNumber}.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                   <FormField
                    control={passwordForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                          <Lock className="h-4 w-4" />
                          New Password
                        </FormLabel>
                        <FormControl>
                          <PasswordInput placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                         <FormLabel className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                          <Lock className="h-4 w-4" />
                          Confirm New Password
                        </FormLabel>
                        <FormControl>
                          <PasswordInput placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full h-12 text-base font-bold" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Reset Password'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </>
        );
        case 3:
            return (
                <>
                <CardHeader className="items-center text-center">
                    <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                    <CardTitle className="text-2xl">Password Reset!</CardTitle>
                    <CardDescription>Your password has been changed successfully.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild className="w-full h-12 text-base font-bold">
                        <Link href="/login">Back to Login</Link>
                    </Button>
                </CardContent>
              </>
            )
      default:
        return null;
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-2xl">
        {renderStep()}
      </Card>
    </div>
  );
}
