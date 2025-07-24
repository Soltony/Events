
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Loader2, ArrowRight, User, Phone, Lock, Mail } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

const registerFormSchema = z.object({
  firstName: z.string().min(1, { message: 'First name is required.' }),
  lastName: z.string().min(1, { message: 'Last name is required.' }),
  phoneNumber: z.string().min(1, { message: 'Phone number is required.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

type RegisterFormValues = z.infer<typeof registerFormSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phoneNumber: '',
      email: '',
      password: '',
    },
  });

  async function onSubmit(data: RegisterFormValues) {
    setIsLoading(true);
    try {
      const response = await api.post(`/api/auth/register`, data);

      if (response.data.isSuccess) {
        toast({
          title: 'Registration Successful!',
          description: 'You can now log in with your credentials.',
        });
        router.push('/login');
      } else {
         throw new Error(response.data.errors?.join(', ') || 'Registration failed');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.join(', ') || error.message || 'An unknown error occurred.';
       toast({
        variant: 'destructive',
        title: 'Registration Failed',
        description: errorMessage,
      });
      console.error("Registration error:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="items-center text-center pt-8 pb-4">
            <Image
                src="/image/nibtickets.jpg"
                alt="NibTera Tickets Logo"
                width={200}
                height={60}
                className="object-contain"
                data-ai-hint="logo nibtera"
                priority
            />
             <h2 className="text-xl font-semibold text-[#8B5E34] pt-2">
                Create an Account
            </h2>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><User className="h-4 w-4" />First Name</FormLabel>
                      <FormControl><Input placeholder="John" {...field} className="bg-transparent text-base border-0 border-b rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><User className="h-4 w-4" />Last Name</FormLabel>
                      <FormControl><Input placeholder="Doe" {...field} className="bg-transparent text-base border-0 border-b rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Phone className="h-4 w-4" />Phone Number</FormLabel>
                    <FormControl><Input placeholder="e.g., 0912345678" {...field} className="bg-transparent text-base border-0 border-b rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Mail className="h-4 w-4" />Email</FormLabel>
                    <FormControl><Input placeholder="e.g., a@a.com" {...field} className="bg-transparent text-base border-0 border-b rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Lock className="h-4 w-4" />Password</FormLabel>
                    <FormControl><PasswordInput placeholder="••••••••" {...field} className="bg-transparent text-base border-0 border-b rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full h-12 text-base font-bold" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <>
                    <ArrowRight className="mr-2 h-5 w-5" />
                    Register
                </>}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
