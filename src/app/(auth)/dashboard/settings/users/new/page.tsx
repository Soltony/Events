
'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import type { Role } from '@prisma/client';
import { useRouter } from 'next/navigation';

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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Loader2, ArrowLeft, UserPlus } from 'lucide-react';
import { useToast } from "@/hooks/use-toast"
import { getRoles, addUser } from '@/lib/actions';
import { PasswordInput } from '@/components/ui/password-input';
import { useAuth } from '@/context/auth-context';

const addUserFormSchema = z.object({
  firstName: z.string().min(1, { message: "First name is required." }),
  lastName: z.string().min(1, { message: "Last name is required." }),
  phoneNumber: z.string().min(10, { message: "Phone number must be at least 10 digits." }),
  email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  roleId: z.string({ required_error: "Please select a role." }),
});

type AddUserFormValues = z.infer<typeof addUserFormSchema>;

export default function UserRegistrationPage() {
    const { toast } = useToast();
    const router = useRouter();
    const { user: currentUser } = useAuth();
    const [roles, setRoles] = useState<Role[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchRolesData = async () => {
            if (!currentUser) return;
            try {
                let fetchedRoles = await getRoles();
                
                // Always filter out the Admin role
                let filteredRoles = fetchedRoles.filter((role: Role) => role.name !== 'Admin');

                // If the current user is a Sub-admin, also filter out the Sub-admin role
                if (currentUser.role?.name === 'Sub-admin') {
                    filteredRoles = filteredRoles.filter((role: Role) => role.name !== 'Sub-admin');
                }
                
                setRoles(filteredRoles);
            } catch (error) {
                console.error("Failed to fetch roles:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load roles.' });
            }
        };
        fetchRolesData();
    }, [toast, currentUser]);
    
    const addUserForm = useForm<AddUserFormValues>({
        resolver: zodResolver(addUserFormSchema),
        defaultValues: {
          firstName: "",
          lastName: "",
          phoneNumber: "",
          email: "",
          password: "",
        },
    });

    async function onAddUserSubmit(data: AddUserFormValues) {
        setIsSubmitting(true);
        try {
            await addUser(data);
            toast({
                title: "User Added",
                description: `Successfully added ${data.firstName} ${data.lastName}.`,
            });
            router.push('/dashboard/settings/users');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to add user.' });
        } finally {
            setIsSubmitting(false);
        }
    }

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="flex items-center gap-4">
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
            <CardDescription>Fill out the form below to register a new user.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...addUserForm}>
                <form onSubmit={addUserForm.handleSubmit(onAddUserSubmit)} className="space-y-4 max-w-lg">
                    <div className="grid grid-cols-2 gap-4">
                    <FormField control={addUserForm.control} name="firstName" render={({ field }) => (
                        <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                        <FormField control={addUserForm.control} name="lastName" render={({ field }) => (
                        <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                </div>
                    <FormField control={addUserForm.control} name="phoneNumber" render={({ field }) => (
                    <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="0912345678" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={addUserForm.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Email (Optional)</FormLabel><FormControl><Input placeholder="john.doe@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                <FormField control={addUserForm.control} name="password" render={({ field }) => (
                    <FormItem><FormLabel>Password</FormLabel><FormControl><PasswordInput placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                    <FormField control={addUserForm.control} name="roleId" render={({ field }) => (
                    <FormItem><FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                            <SelectContent>{roles.map((role) => (<SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>))}</SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}/>
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
  );
}
