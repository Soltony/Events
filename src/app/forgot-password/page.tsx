
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Loader2, ArrowRight, Phone, Lock, KeyRound, CheckCircle, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';

const phoneSchema = z.object({
  phoneNumber: z.string().min(10, { message: 'Phone number must be at least 10 digits.' }),
});

const otpSchema = z.object({
  otp: z.string().length(6, { message: 'OTP must be 6 digits.' }),
});

const passwordSchema = z.object({
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

type PhoneFormValues = z.infer<typeof phoneSchema>;
type OtpFormValues = z.infer<typeof otpSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpToken, setOtpToken] = useState('');

  const phoneForm = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phoneNumber: '' },
  });

  const otpForm = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const handlePhoneSubmit = async (data: PhoneFormValues) => {
    setIsLoading(true);
    try {
        await api.put('/api/auth/forgot-password', { phoneNumber: data.phoneNumber });
        setPhoneNumber(data.phoneNumber);
        setStep(2);
        toast({
            title: 'OTP Sent',
            description: 'An OTP has been sent to your phone number.',
        });
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error.response?.data?.errors?.[0] || 'Could not send OTP. Please check the phone number.',
        });
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleOtpSubmit = async (data: OtpFormValues) => {
    setIsLoading(true);
    try {
        const response = await api.put('/api/auth/verify-otp', { phoneNumber, otp: data.otp });
        if (response.data?.token) {
            setOtpToken(response.data.token);
            setStep(3);
        } else {
            throw new Error("Invalid OTP verification response.");
        }
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'OTP Verification Failed',
            description: error.response?.data?.errors?.[0] || 'The OTP is incorrect or has expired.',
        });
    } finally {
        setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (data: PasswordFormValues) => {
    setIsLoading(true);
    try {
        await api.post('/api/auth/reset-password', {
            phoneNumber,
            token: otpToken,
            newPassword: data.password,
        });
        setStep(4);
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error.response?.data?.errors?.[0] || 'Failed to reset password.',
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
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Request OTP <ArrowRight className="ml-2 h-5 w-5" /></>}
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
                <ShieldCheck className="h-12 w-12 text-primary mb-4" />
                <CardTitle className="text-2xl">Verify Your Identity</CardTitle>
                <CardDescription>Enter the 6-digit code sent to {phoneNumber}.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...otpForm}>
                <form onSubmit={otpForm.handleSubmit(handleOtpSubmit)} className="space-y-6">
                  <FormField
                    control={otpForm.control}
                    name="otp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                          <KeyRound className="h-4 w-4" />
                          One-Time Password (OTP)
                        </FormLabel>
                        <FormControl>
                           <Input placeholder="123456" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full h-12 text-base font-bold" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Verify OTP <ArrowRight className="ml-2 h-5 w-5" /></>}
                  </Button>
                </form>
              </Form>
              <div className="mt-4 text-center text-sm">
                 <Button variant="link" onClick={() => setStep(1)} className="p-0 h-auto">
                    Use a different phone number
                 </Button>
              </div>
            </CardContent>
          </>
        )
      case 3:
        return (
          <>
             <CardHeader className="items-center text-center">
                <Lock className="h-12 w-12 text-primary mb-4" />
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
        case 4:
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
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        {renderStep()}
      </Card>
    </div>
  );
}
