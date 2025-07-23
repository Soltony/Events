
'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import type { User, Role } from '@prisma/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { PlusCircle, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from '@/components/ui/skeleton';
import { getUsersAndRoles, addUser, updateUserRole } from '@/lib/actions';
import { PasswordInput } from '@/components/ui/password-input';

interface UserWithRole extends User {
    role: Role;
}

const addUserFormSchema = z.object({
  firstName: z.string().min(1, { message: "First name is required." }),
  lastName: z.string().min(1, { message: "Last name is required." }),
  phoneNumber: z.string().min(1, { message: "Phone number is required." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  roleId: z.string({ required_error: "Please select a role." }),
});

type AddUserFormValues = z.infer<typeof addUserFormSchema>;

export default function SettingsPage() {
    const { toast } = useToast();
    const [users, setUsers] = useState<UserWithRole[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);

    const fetchData = async () => {
        try {
            !loading && setLoading(true);
            const { users, roles } = await getUsersAndRoles();
            setUsers(users);
            setRoles(roles);
        } catch (error) {
            console.error("Failed to fetch settings data:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load users and roles.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRoleChange = async (userId: string, newRoleId: string) => {
        const oldUsers = [...users];
        const newUsers = users.map(user => user.id === userId ? { ...user, roleId: newRoleId, role: roles.find(r => r.id === newRoleId)! } : user);
        setUsers(newUsers);

        try {
            await updateUserRole(userId, newRoleId);
            toast({ title: "User Role Updated" });
        } catch (error) {
            setUsers(oldUsers);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update user role.' });
        }
    };

    const addUserForm = useForm<AddUserFormValues>({
        resolver: zodResolver(addUserFormSchema),
        defaultValues: {
          firstName: "",
          lastName: "",
          phoneNumber: "0912345678",
          password: "",
        },
    });

    async function onAddUserSubmit(data: AddUserFormValues) {
        try {
            await addUser(data);
            toast({
                title: "User Added",
                description: `Successfully added ${data.firstName} ${data.lastName}.`,
            });
            await fetchData();
            setIsAddUserOpen(false);
            addUserForm.reset();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to add user.' });
        }
    }

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
       <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
            Manage user accounts and their roles.
            </p>
      </div>
      {loading ? (
        <div className="space-y-4">
            <Card>
                <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                <CardContent><Skeleton className="h-40 w-full" /></CardContent>
            </Card>
        </div>
      ) : (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>Assign roles to users in the system.</CardDescription>
                </div>
                <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                  <DialogTrigger asChild>
                    <Button><PlusCircle className="mr-2 h-4 w-4" /> Add User</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New User</DialogTitle>
                      <DialogDescription>
                          Invite a new member to your team by filling out the details below.
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...addUserForm}>
                      <form onSubmit={addUserForm.handleSubmit(onAddUserSubmit)} className="space-y-4">
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
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAddUserOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={addUserForm.formState.isSubmitting}>
                                {addUserForm.formState.isSubmitting && <Loader2 className="animate-spin mr-2" />} Add User
                            </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Phone Number</TableHead>
                            <TableHead className="w-[180px]">Role</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium">{user.firstName} {user.lastName}</TableCell>
                                <TableCell>{user.phoneNumber}</TableCell>
                                <TableCell>
                                    <Select value={user.roleId} onValueChange={(newRoleId) => handleRoleChange(user.id, newRoleId)}>
                                        <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                                        <SelectContent>{roles.map((role) => (<SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>))}</SelectContent>
                                    </Select>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
