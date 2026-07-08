
'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import type { Branch, Role } from '@prisma/client';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ArrowLeft, UserPlus, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getBranches, getRoles, addUser } from '@/lib/super-admin-user-actions';

const addUserFormSchema = z.object({
  firstName: z.string().min(1, { message: 'First name is required.' }),
  lastName: z.string().min(1, { message: 'Last name is required.' }),
  phoneNumber: z.string().min(10, { message: 'Phone number must be at least 10 digits.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  roleId: z.string({ required_error: 'Please select a role.' }),
  branchId: z.string().optional(),
});

type AddUserFormValues = z.infer<typeof addUserFormSchema>;

export default function UserRegistrationPageContent() {
  const { toast } = useToast();
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [fetchedRoles, fetchedBranches] = await Promise.all([getRoles(), getBranches()]);
        // Super Admin can assign any role, including Admin and Staff, but the
        // reserved "Super Admin" role is exclusive to the one Super Admin account.
        setRoles(fetchedRoles.filter((r: Role) => r.name !== 'Super Admin'));
        setBranches(fetchedBranches);
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load roles or branches.' });
      }
    })();
  }, [toast]);

  const addUserForm = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phoneNumber: '',
      email: '',
    },
  });

  async function onAddUserSubmit(data: AddUserFormValues) {
    setIsSubmitting(true);
    setIsSuccess(false);
    try {
      const result = await addUser(data);

      if (result.success) {
        toast({ title: 'User Added', description: `An email with credentials has been sent to ${data.email}.` });
        setIsSuccess(true);
      } else {
        toast({ variant: 'destructive', title: 'Failed to Add User', description: result.error || 'An unknown error occurred.' });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error?.message || 'Something went wrong.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>User Registered Successfully!</CardTitle>
            <CardDescription>The user has been created and their temporary password has been sent to their email address.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert variant="default" className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
              <Check className="h-4 w-4 text-green-600 dark:text-green-300" />
              <AlertTitle className="text-green-800 dark:text-green-300">Email Sent</AlertTitle>
              <AlertDescription className="text-green-700 dark:text-green-400">
                An email containing the login credentials and next steps has been sent to the user.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => { setIsSuccess(false); addUserForm.reset(); }}>
                Add Another User
              </Button>
              <Button onClick={() => router.push('/super-admin/users')}>Done</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-4 mb-4 md:mb-8">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Registration</h1>
            <p className="text-muted-foreground">Create a new user account.</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>New User Details</CardTitle>
            <CardDescription>A temporary password will be sent to the user&apos;s email address.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...addUserForm}>
              <form onSubmit={addUserForm.handleSubmit(onAddUserSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={addUserForm.control} name="firstName" render={({ field }) => (
                    <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={addUserForm.control} name="lastName" render={({ field }) => (
                    <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={addUserForm.control} name="phoneNumber" render={({ field }) => (
                  <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="0912345678" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={addUserForm.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="john.doe@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={addUserForm.control} name="roleId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {roles.map((role) => (<SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={addUserForm.control} name="branchId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch <span className="text-muted-foreground">(Optional)</span></FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a branch" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {branches.map((branch) => (<SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting} style={{ backgroundColor: '#FBBF24', color: '#422006' }}>
                    {isSubmitting && <Loader2 className="animate-spin mr-2" />} <UserPlus className="mr-2 h-4 w-4" /> Register User
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
