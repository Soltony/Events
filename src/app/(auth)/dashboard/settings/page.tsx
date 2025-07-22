
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Pencil, PlusCircle, Shield, Trash2, Loader2, ChevronRight } from 'lucide-react';
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { getUsersAndRoles, addUser, createRole, updateRole, deleteRole, updateUserRole } from '@/lib/actions';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

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

const permissionCategories = [
  { id: 'Dashboard', label: 'Dashboard' },
  { id: 'Events', label: 'Events' },
  { id: 'Reports', label: 'Reports' },
  { id: 'Settings', label: 'Settings' },
];

const permissionActions = ['View', 'Create', 'Update', 'Delete'];


const roleFormSchema = z.object({
    name: z.string().min(1, { message: "Role name is required." }),
    description: z.string().optional(),
    permissions: z.array(z.string()).refine((value) => value.length > 0, {
        message: "You have to select at least one permission.",
    }),
});

type RoleFormValues = z.infer<typeof roleFormSchema>;

export default function SettingsPage() {
    const { toast } = useToast();
    const [users, setUsers] = useState<UserWithRole[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

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
          phoneNumber: "",
          password: "",
        },
    });

    const roleForm = useForm<RoleFormValues>({
        resolver: zodResolver(roleFormSchema),
    });

    useEffect(() => {
        if (editingRole) {
            roleForm.reset({
                name: editingRole.name,
                description: editingRole.description || '',
                permissions: Array.isArray(editingRole.permissions) ? editingRole.permissions : [],
            });
        } else {
            roleForm.reset({ name: '', description: '', permissions: [] });
        }
    }, [editingRole, roleForm]);


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

    async function onRoleSubmit(data: RoleFormValues) {
        try {
            const roleData = {
                ...data,
                permissions: data.permissions,
            };

            if (editingRole) {
                await updateRole(editingRole.id, roleData);
                toast({ title: "Role Updated", description: `Successfully updated the ${data.name} role.` });
            } else {
                await createRole(roleData);
                toast({ title: "Role Created", description: `Successfully created the ${data.name} role.` });
            }
            await fetchData();
            setEditingRole(null);
            setIsRoleDialogOpen(false);
            roleForm.reset();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to save role.` });
        }
    }

    async function handleDeleteRole() {
        if (!roleToDelete) return;
        try {
            await deleteRole(roleToDelete.id);
            toast({
                title: 'Role Deleted',
                description: `The "${roleToDelete.name}" role has been deleted.`,
            });
            await fetchData();
            setRoleToDelete(null);
        } catch(e: any) {
             toast({ variant: 'destructive', title: 'Error', description: e.message || 'Failed to delete role.' });
        }
    }
    
    const openRoleDialog = (role: Role | null) => {
        setEditingRole(role);
        setIsRoleDialogOpen(true);
    };

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
       <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
            Manage user roles, permissions, and other application settings.
            </p>
      </div>
      {loading ? (
        <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <Card>
                <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                <CardContent><Skeleton className="h-40 w-full" /></CardContent>
            </Card>
        </div>
      ) : (
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="roles">Role Management</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Users</CardTitle>
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
                                <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="+1234567890" {...field} /></FormControl><FormMessage /></FormItem>
                             )}/>
                            <FormField control={addUserForm.control} name="password" render={({ field }) => (
                                <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>
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
        </TabsContent>
        <TabsContent value="roles">
             <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Roles</CardTitle>
                        <CardDescription>Define roles and their permissions within the application.</CardDescription>
                    </div>
                     <Button onClick={() => openRoleDialog(null)}><PlusCircle className="mr-2 h-4 w-4" /> Create Role</Button>
                </CardHeader>
                <CardContent>
                   <ScrollArea className="h-[calc(100vh-22rem)]">
                        <div className="space-y-4 pr-6">
                            {roles.map((role) => (
                                <Card key={role.id} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-primary/10 text-primary p-3 rounded-full">
                                                <Shield className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-lg">{role.name}</h3>
                                                <p className="text-sm text-muted-foreground">{role.description}</p>
                                                <p className="text-xs text-primary font-medium mt-1">{(Array.isArray(role.permissions) ? role.permissions : []).length} permissions granted</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                                            <Button variant="outline" size="sm" onClick={() => openRoleDialog(role)} disabled={role.name === 'Admin'}>
                                                <Pencil className="mr-2 h-4 w-4" />Edit
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => setRoleToDelete(role)} disabled={role.name === 'Admin'} aria-label="Delete role">
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                   </ScrollArea>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
      )}

      {/* Role Create/Edit Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={(open) => { if (!open) { setIsRoleDialogOpen(false); setEditingRole(null); }}}>
        <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90vh]">
            <DialogHeader>
                <DialogTitle>{editingRole ? `Edit Role: ${editingRole.name}` : 'Create New Role'}</DialogTitle>
                <DialogDescription>{editingRole ? 'Modify the permissions for this role.' : 'Define a new role and select the granular permissions it has for each page.'}</DialogDescription>
            </DialogHeader>
            <Form {...roleForm}>
                <form onSubmit={roleForm.handleSubmit(onRoleSubmit)} className="flex-1 flex flex-col min-h-0">
                  <ScrollArea className="flex-1 -mx-6 px-6">
                    <div className="space-y-4 px-1 py-4">
                        <FormField control={roleForm.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Role Name</FormLabel><FormControl><Input placeholder="e.g., Event Manager" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={roleForm.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Description</FormLabel><FormControl><Input placeholder="Briefly describe this role's purpose" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                    
                        <Separator className="my-6" />

                        <div className="space-y-2">
                            <FormLabel>Permissions</FormLabel>
                            <FormDescription>Select the actions this role can perform on each page.</FormDescription>
                            <FormMessage>{roleForm.formState.errors.permissions?.root?.message || roleForm.formState.errors.permissions?.message}</FormMessage>
                        </div>
                        <div className="space-y-4 pt-2">
                            <FormField
                                control={roleForm.control}
                                name="permissions"
                                render={({ field }) => (
                                  <div className="space-y-4">
                                      {permissionCategories.map((category) => (
                                          <Card key={category.id}>
                                              <CardHeader className="p-4">
                                                  <CardTitle className="text-base">{category.label}</CardTitle>
                                              </CardHeader>
                                              <CardContent className="p-4 pt-0">
                                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
                                                      {permissionActions.map((action) => {
                                                          const permissionId = `${category.id}:${action}`;
                                                          return (
                                                              <FormItem key={permissionId} className="flex flex-row items-center space-x-2 space-y-0">
                                                                  <FormControl>
                                                                      <Checkbox
                                                                          checked={field.value?.includes(permissionId)}
                                                                          onCheckedChange={(checked) => {
                                                                              const currentPermissions = field.value || [];
                                                                              return checked
                                                                                  ? field.onChange([...currentPermissions, permissionId])
                                                                                  : field.onChange(
                                                                                      currentPermissions.filter(
                                                                                          (value) => value !== permissionId
                                                                                      )
                                                                                  );
                                                                          }}
                                                                      />
                                                                  </FormControl>
                                                                  <FormLabel className="text-sm font-normal">
                                                                      {action}
                                                                  </FormLabel>
                                                              </FormItem>
                                                          );
                                                      })}
                                                  </div>
                                              </CardContent>
                                          </Card>
                                      ))}
                                  </div>
                                )}
                              />
                        </div>
                    </div>
                  </ScrollArea>
                  <DialogFooter className="pt-6 border-t -mx-6 px-6 bg-background sticky bottom-0">
                      <Button type="button" variant="outline" onClick={() => { setIsRoleDialogOpen(false); setEditingRole(null); }}>Cancel</Button>
                      <Button type="submit" disabled={roleForm.formState.isSubmitting}>
                          {roleForm.formState.isSubmitting && <Loader2 className="animate-spin mr-2" />}Save Changes
                      </Button>
                  </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Role Alert Dialog */}
      <AlertDialog open={!!roleToDelete} onOpenChange={(open) => !open && setRoleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the <span className="font-semibold"> {roleToDelete?.name} </span> role. Users assigned to this role will lose their permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRoleToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRole}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
