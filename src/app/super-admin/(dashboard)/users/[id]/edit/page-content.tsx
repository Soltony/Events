
'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import type { Role, User, Branch, District } from '@prisma/client';
import { useRouter, useParams } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getRoles, getUserById, updateUser, getBranches, getDistricts } from '@/lib/super-admin-user-actions';
import { Skeleton } from '@/components/ui/skeleton';

const editUserFormSchema = z.object({
  firstName: z.string().min(1, { message: 'First name is required.' }),
  lastName: z.string().min(1, { message: 'Last name is required.' }),
  phoneNumber: z.string().min(10, { message: 'Phone number must be at least 10 digits.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  roleId: z.string({ required_error: 'Please select a role.' }),
  branchId: z.string().optional().nullable(),
  nibBankAccount: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((val) => !val || (val.length >= 13 && val.length <= 15), { message: 'NIB Account must be between 13 and 15 digits.' })
    .refine((val) => !val || val.startsWith('70'), { message: 'NIB Account must start with 70.' }),
});

type EditUserFormValues = z.infer<typeof editUserFormSchema>;

interface UserWithRole extends User {
  role: Role;
}

export default function EditUserPageContent({ basePath = '/super-admin' }: { basePath?: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const userId = params.id;

  const [user, setUser] = useState<UserWithRole | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phoneNumber: '',
      email: '',
      roleId: '',
      branchId: null,
      nibBankAccount: '',
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) {
        router.push(`${basePath}/users`);
        return;
      }
      try {
        setLoading(true);
        const [userData, rolesData, branchesData, districtsData] = await Promise.all([
          getUserById(userId),
          getRoles(),
          getBranches(),
          getDistricts(),
        ]);

        if (userData) {
          setUser(userData);
          // The reserved "Super Admin" role is exclusive to the one Super Admin
          // account and must never appear as an assignable option for a User.
          setRoles(rolesData.filter((r: Role) => r.name !== 'Super Admin'));
          setBranches(branchesData);
          setDistricts(districtsData);
          // Pre-filter the Branch dropdown to the district the user's current
          // branch already belongs to, so editing doesn't reset the selection.
          const currentBranch = branchesData.find((b: Branch) => b.id === userData.branchId);
          setSelectedDistrictId(currentBranch?.districtId ?? '');
          form.reset({
            firstName: userData.firstName,
            lastName: userData.lastName,
            phoneNumber: userData.phoneNumber,
            email: userData.email || '',
            roleId: userData.roleId,
            branchId: userData.branchId,
            nibBankAccount: userData.nibBankAccount || '',
          });
        } else {
          toast({ variant: 'destructive', title: 'Error', description: 'User not found.' });
          router.push(`${basePath}/users`);
        }
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load user data.' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const branchesForSelectedDistrict = branches.filter((branch) => branch.districtId === selectedDistrictId);

  async function onSubmit(data: EditUserFormValues) {
    if (!userId) return;
    setIsSubmitting(true);
    try {
      const updated = await updateUser(userId, data);
      // Event Organizer Maker-Checker: editing an Organizer's role or details
      // sends them back into the Pending Approval queue, so let the editor
      // know a re-review is now required instead of implying it's final.
      toast(
        updated?.status === 'PENDING'
          ? {
              title: 'Sent for Re-Approval',
              description: `${data.firstName} ${data.lastName} was updated and now requires review on the Organizer Approvals page.`,
            }
          : { title: 'User Updated', description: `Successfully updated ${data.firstName} ${data.lastName}.` }
      );
      router.push(`${basePath}/users`);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to update user.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 md:gap-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-5 w-48" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-48 mb-2" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent className="space-y-8">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <div className="flex justify-end">
              <Skeleton className="h-10 w-32" />
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
            <h1 className="text-3xl font-bold tracking-tight">Edit User</h1>
            <p className="text-muted-foreground">Update details for {user?.firstName} {user?.lastName}</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>User Details</CardTitle>
            <CardDescription>Update the user&apos;s information below.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                  <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="0912345678" {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="john.doe@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name="nibBankAccount" render={({ field }) => (
                  <FormItem><FormLabel>NIB Account <span className="text-muted-foreground"></span></FormLabel><FormControl><Input placeholder="700***********" {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="roleId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {roles.map((role) => (<SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormItem>
                    <FormLabel>District</FormLabel>
                    <Select
                      value={selectedDistrictId || 'none'}
                      onValueChange={(value) => {
                        setSelectedDistrictId(value === 'none' ? '' : value);
                        // Changing the district invalidates the previously selected
                        // branch, since it may not belong to the new district.
                        form.setValue('branchId', null);
                      }}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="Select a district" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">No District</SelectItem>
                        {districts.map((district) => (<SelectItem key={district.id} value={district.id}>{district.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                </div>
                <FormField control={form.control} name="branchId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                      value={field.value ?? 'none'}
                      disabled={!selectedDistrictId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={selectedDistrictId ? 'Select a branch' : 'Select a district first'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Branch</SelectItem>
                        {branchesForSelectedDistrict.map((branch) => (<SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting} style={{ backgroundColor: '#FBBF24', color: '#422006' }}>
                    {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
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
