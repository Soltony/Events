
'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import type { Role, User } from '@prisma/client';
import { useRouter, useParams } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Loader2, ArrowLeft, Save } from 'lucide-react';
import { useToast } from "@/hooks/use-toast"
import { getRoles, getUserById, updateUser } from '@/lib/actions';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';

const editUserFormSchema = z.object({
  firstName: z.string().min(1, { message: "First name is required." }),
  lastName: z.string().min(1, { message: "Last name is required." }),
  roleId: z.string({ required_error: "Please select a role." }),
});

type EditUserFormValues = z.infer<typeof editUserFormSchema>;

interface UserWithRole extends User {
    role: Role;
}

const roleHierarchy: Record<string, number> = {
    'Admin': 3,
    'Sub-admin': 2,
    'Organizer': 1,
};

export default function EditUserPage() {
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const userId = params.id;
    const { user: currentUser } = useAuth();

    const [user, setUser] = useState<UserWithRole | null>(null);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<EditUserFormValues>({
        resolver: zodResolver(editUserFormSchema),
        defaultValues: {
            firstName: '',
            lastName: '',
            roleId: '',
        }
    });

    useEffect(() => {
        const fetchData = async () => {
            if (!userId || !currentUser) {
                router.push('/dashboard/settings/users');
                return;
            }
            try {
                setLoading(true);
                const [userData, rolesData] = await Promise.all([
                    getUserById(userId),
                    getRoles(),
                ]);

                if (userData) {
                    const currentUserRoleRank = currentUser.role?.name ? (roleHierarchy[currentUser.role.name] || 0) : 0;
                    const targetUserRoleRank = userData.role?.name ? (roleHierarchy[userData.role.name] || 0) : 0;

                    // Deny access if a user tries to edit someone with an equal or higher role, unless it's an admin editing themselves
                    if (currentUserRoleRank <= targetUserRoleRank && currentUser.id !== userData.id) {
                        toast({ variant: 'destructive', title: 'Access Denied', description: "You don't have permission to edit this user." });
                        router.push('/dashboard/settings/users');
                        return;
                    }

                    setUser(userData);
                    setRoles(rolesData.filter((role: Role) => role.name !== 'Admin'));
                    form.reset({
                        firstName: userData.firstName,
                        lastName: userData.lastName,
                        roleId: userData.roleId,
                    });
                } else {
                    toast({ variant: 'destructive', title: 'Error', description: 'User not found.' });
                    router.push('/dashboard/settings/users');
                }
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to load user data.' });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [userId, router, toast, form, currentUser]);
    
    async function onSubmit(data: EditUserFormValues) {
        if (!userId) return;
        setIsSubmitting(true);
        try {
            await updateUser(userId, data);
            toast({
                title: "User Updated",
                description: `Successfully updated ${data.firstName} ${data.lastName}.`,
            });
            router.push('/dashboard/settings/users');
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
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="flex items-center gap-4">
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
            <CardDescription>Update the user's information below.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="firstName" render={({ field }) => (
                            <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="lastName" render={({ field }) => (
                            <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                    </div>
                    
                    <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                            <Input placeholder="0912345678" value={user?.phoneNumber || ''} disabled />
                        </FormControl>
                        <FormDescription>Phone number cannot be changed.</FormDescription>
                    </FormItem>
                   
                    <FormField control={form.control} name="roleId" render={({ field }) => (
                        <FormItem><FormLabel>Role</FormLabel>
                            <Select 
                                onValueChange={field.onChange} 
                                value={field.value}
                                disabled={user?.role?.name === 'Admin'}
                            >
                                <FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                                <SelectContent>{roles.map((role) => (<SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>))}</SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}/>
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
  );
}
