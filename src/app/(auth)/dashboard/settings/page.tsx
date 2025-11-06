
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Settings, UserPlus, Users, ShieldCheck, Building, User, Phone, Save, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

const branchFormSchema = z.object({
  branchName: z.string().min(1, 'Branch name is required.'),
  districtName: z.string().min(1, 'District name is required.'),
  contactPersonName: z.string().min(1, 'Contact person name is required.'),
  contactPersonPhone: z.string().min(1, 'Contact person phone is required.'),
});

type BranchFormValues = z.infer<typeof branchFormSchema>;

export default function SettingsPage() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const managementCards = [
    {
      title: 'User Registration',
      icon: <UserPlus className="h-5 w-5" />,
      description: 'Register new users for the application. Create new accounts. New users are created without any roles by default.',
      buttonText: 'Go to User Registration',
      href: '/dashboard/settings/users/new',
      color: '#FBBF24',
      textColor: '#422006',
      permission: 'User Registration:Read'
    },
    {
      title: 'User Management',
      icon: <Users className="h-5 w-5" />,
      description: 'Manage user roles and the buildings they are assigned to. Assign roles and buildings to users to control access and responsibilities.',
      buttonText: 'Go to User Management',
      href: '/dashboard/settings/users',
      color: '#FBBF24',
      textColor: '#422006',
      permission: 'User Management:Read'
    },
    {
      title: 'Role Management',
      icon: <ShieldCheck className="h-5 w-5" />,
      description: 'Define roles and their permissions within the application. Create new roles, or edit existing ones to specify what actions users with that role can perform.',
      buttonText: 'Go to Role Management',
      href: '/dashboard/settings/roles',
      color: '#FBBF24',
      textColor: '#422006',
      permission: 'Role Management:Read'
    }
  ];

  const branchForm = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: {
      branchName: '',
      districtName: '',
      contactPersonName: '',
      contactPersonPhone: '',
    },
  });

  const onBranchSubmit = (data: BranchFormValues) => {
    setIsSubmitting(true);
    // Placeholder for actual submission logic
    console.log('Branch registration data:', data);
    setTimeout(() => {
        toast({
            title: 'Registration Submitted',
            description: 'The branch and district information has been recorded.',
        });
        branchForm.reset();
        setIsSubmitting(false);
    }, 1000);
  };

  const visibleCards = managementCards.filter(card => hasPermission(card.permission));

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="flex items-center gap-4">
        <Settings className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Application Settings</h1>
          <p className="text-muted-foreground">
            Manage users and other application configurations.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {visibleCards.map((card) => (
          <Card key={card.title} className="flex flex-col">
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow">
              <CardDescription>{card.description}</CardDescription>
            </CardContent>
            <CardFooter>
                <Button asChild className="w-full" style={{ backgroundColor: card.color, color: card.textColor }}>
                <Link href={card.href}>
                  {card.icon}
                  {card.buttonText}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

       <div className="mt-8">
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Branch and District Registration</CardTitle>
                <CardDescription>Add new branch and district information to the system.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...branchForm}>
                    <form onSubmit={branchForm.handleSubmit(onBranchSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={branchForm.control}
                                name="branchName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Branch Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g., Main Branch" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={branchForm.control}
                                name="districtName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>District Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g., Central District" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={branchForm.control}
                                name="contactPersonName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contact Person Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g., Jane Doe" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={branchForm.control}
                                name="contactPersonPhone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contact Person Phone Number</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g., 0912345678" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="flex justify-end pt-2">
                             <Button type="submit" disabled={isSubmitting} style={{ backgroundColor: '#FBBF24', color: '#422006' }}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Registration
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
