
'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
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
import { Pencil, PlusCircle, Shield, Trash2 } from 'lucide-react';
import { mockUsers, mockRoles, type Role } from '@/lib/mock-data';
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from '@/components/ui/scroll-area';

const addUserFormSchema = z.object({
  name: z.string().min(1, { message: "Name is required." }),
  email: z.string().email({ message: "Please enter a valid email." }),
  role: z.string({ required_error: "Please select a role." }),
});

type AddUserFormValues = z.infer<typeof addUserFormSchema>;

const permissionModules = [
    { name: 'Events', permissions: ['Create', 'Read', 'Update', 'Delete'] },
    { name: 'Attendees', permissions: ['Read', 'Update'] },
    { name: 'Reports', permissions: ['Read'] },
    { name: 'Users & Roles', permissions: ['Create', 'Read', 'Update', 'Delete'] }
];
const permissionActions = ['Create', 'Read', 'Update', 'Delete'];

const roleFormSchema = z.object({
    name: z.string().min(1, { message: "Role name is required." }),
    permissions: z.array(z.string()).refine((value) => value.some((item) => item), {
        message: "You have to select at least one permission.",
    }),
});

type RoleFormValues = z.infer<typeof roleFormSchema>;

export default function SettingsPage() {
    const { toast } = useToast();
    const [users, setUsers] = useState(mockUsers);
    const [roles, setRoles] = useState<Role[]>(mockRoles);
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);


    const handleRoleChange = (userId: number, newRole: string) => {
        setUsers(users.map(user => user.id === userId ? { ...user, role: newRole } : user));
    };

    const addUserForm = useForm<AddUserFormValues>({
        resolver: zodResolver(addUserFormSchema),
        defaultValues: {
          name: "",
          email: "",
        },
    });

    const createRoleForm = useForm<RoleFormValues>({
        resolver: zodResolver(roleFormSchema),
        defaultValues: {
            name: "",
            permissions: [],
        },
    });
    
    const editRoleForm = useForm<RoleFormValues>({
        resolver: zodResolver(roleFormSchema),
    });

    useEffect(() => {
        if (editingRole) {
            editRoleForm.reset({
                name: editingRole.name,
                permissions: editingRole.permissions,
            });
        }
    }, [editingRole, editRoleForm]);


    function onAddUserSubmit(data: AddUserFormValues) {
        const newUser = {
            id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
            ...data,
        };
        setUsers([...users, newUser]);
        toast({
            title: "User Added",
            description: `Successfully added ${data.name}.`,
        });
        setIsAddUserOpen(false);
        addUserForm.reset();
    }

    function onCreateRoleSubmit(data: RoleFormValues) {
        const newRole: Role = {
            id: `role-${Math.random().toString(36).substring(2, 9)}`,
            name: data.name,
            description: "Custom role with defined permissions.",
            permissions: data.permissions,
        };
        setRoles([...roles, newRole]);
        toast({
            title: "Role Created",
            description: `Successfully created the ${data.name} role.`,
        });
        setIsCreateRoleOpen(false);
        createRoleForm.reset({ name: '', permissions: [] });
    }

    function onEditRoleSubmit(data: RoleFormValues) {
        if (!editingRole) return;

        const updatedRole: Role = {
            ...editingRole,
            name: data.name,
            permissions: data.permissions,
        };

        setRoles(roles.map((r) => (r.id === editingRole.id ? updatedRole : r)));
        toast({
            title: "Role Updated",
            description: `Successfully updated the ${data.name} role.`,
        });
        setEditingRole(null);
    }

    function handleDeleteRole() {
        if (!roleToDelete) return;
        setRoles(roles.filter((role) => role.id !== roleToDelete.id));
        toast({
            title: 'Role Deleted',
            description: `The "${roleToDelete.name}" role has been deleted.`,
        });
        setRoleToDelete(null);
    }


  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
       <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
            Manage user roles, permissions, and other application settings.
            </p>
      </div>

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
                             <FormField
                                control={addUserForm.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Full Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="John Doe" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={addUserForm.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                            <Input placeholder="john.doe@example.com" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={addUserForm.control}
                                name="role"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Role</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a role" />
                                        </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                        {roles.map((role) => (
                                            <SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>
                                        ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsAddUserOpen(false)}>Cancel</Button>
                                <Button type="submit">Add User</Button>
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
                                <TableHead>Email</TableHead>
                                <TableHead className="w-[180px]">Role</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.name}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                        <Select value={user.role} onValueChange={(newRole) => handleRoleChange(user.id, newRole)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select role" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {roles.map((role) => (
                                                     <SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>
                                                ))}
                                            </SelectContent>
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
                     <Dialog open={isCreateRoleOpen} onOpenChange={setIsCreateRoleOpen}>
                      <DialogTrigger asChild>
                        <Button><PlusCircle className="mr-2 h-4 w-4" /> Create Role</Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-2xl">
                          <DialogHeader>
                              <DialogTitle>Create New Role</DialogTitle>
                              <DialogDescription>
                                  Define a new role and select the permissions for it.
                              </DialogDescription>
                          </DialogHeader>
                          <Form {...createRoleForm}>
                              <form onSubmit={createRoleForm.handleSubmit(onCreateRoleSubmit)} className="space-y-6">
                                  <FormField
                                      control={createRoleForm.control}
                                      name="name"
                                      render={({ field }) => (
                                          <FormItem>
                                              <FormLabel>Role Name</FormLabel>
                                              <FormControl>
                                                  <Input placeholder="e.g., Marketing" {...field} />
                                              </FormControl>
                                              <FormMessage />
                                          </FormItem>
                                      )}
                                  />
                                   <FormField
                                        control={createRoleForm.control}
                                        name="permissions"
                                        render={() => (
                                            <FormItem>
                                                <div className="mb-4">
                                                    <FormLabel>Permissions</FormLabel>
                                                    <FormDescription>
                                                        Select the permissions for this new role.
                                                    </FormDescription>
                                                </div>
                                                <ScrollArea className="h-72 rounded-md border">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-[180px]">Module</TableHead>
                                                            {permissionActions.map(action => <TableHead key={action}>{action}</TableHead>)}
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {permissionModules.map((module) => (
                                                            <TableRow key={module.name}>
                                                                <TableCell className="font-medium">{module.name}</TableCell>
                                                                {permissionActions.map(action => (
                                                                    <TableCell key={action} className="text-center">
                                                                        {module.permissions.includes(action) ? (
                                                                            <FormField
                                                                                control={createRoleForm.control}
                                                                                name="permissions"
                                                                                render={({ field }) => {
                                                                                    const permissionString = `${module.name}:${action}`;
                                                                                    return (
                                                                                        <FormItem className="flex items-center justify-center">
                                                                                        <FormControl>
                                                                                            <Checkbox
                                                                                                checked={field.value?.includes(permissionString)}
                                                                                                onCheckedChange={(checked) => {
                                                                                                    return checked
                                                                                                        ? field.onChange([...field.value, permissionString])
                                                                                                        : field.onChange(field.value?.filter((value) => value !== permissionString))
                                                                                                }}
                                                                                            />
                                                                                        </FormControl>
                                                                                        </FormItem>
                                                                                    )
                                                                                }}
                                                                            />
                                                                        ) : null}
                                                                    </TableCell>
                                                                ))}
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                                </ScrollArea>
                                                <FormMessage className="pt-2">{createRoleForm.formState.errors.permissions?.message}</FormMessage>
                                            </FormItem>
                                        )}
                                    />
                                  <DialogFooter>
                                      <Button type="button" variant="outline" onClick={() => setIsCreateRoleOpen(false)}>Cancel</Button>
                                      <Button type="submit">Create Role</Button>
                                  </DialogFooter>
                              </form>
                          </Form>
                      </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                   <div className="space-y-4">
                        {roles.map((role) => (
                            <Card key={role.id}>
                                <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <Shield className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                                        <div>
                                            <h3 className="font-semibold text-lg">{role.name}</h3>
                                            <p className="text-sm text-muted-foreground">{role.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => setEditingRole(role)}
                                            disabled={role.name === 'Admin'}
                                        >
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Edit Permissions
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => setRoleToDelete(role)}
                                            disabled={role.name === 'Admin'}
                                            aria-label="Delete role"
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
      
      {/* Edit Role Dialog */}
      <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Edit Role: {editingRole?.name}</DialogTitle>
                <DialogDescription>
                    Modify the permissions for this role.
                </DialogDescription>
            </DialogHeader>
            <Form {...editRoleForm}>
                <form onSubmit={editRoleForm.handleSubmit(onEditRoleSubmit)} className="space-y-6">
                    <FormField
                        control={editRoleForm.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Role Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., Marketing" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={editRoleForm.control}
                        name="permissions"
                        render={() => (
                            <FormItem>
                                <div className="mb-4">
                                    <FormLabel>Permissions</FormLabel>
                                    <FormDescription>
                                        Select the permissions for this role.
                                    </FormDescription>
                                </div>
                                <ScrollArea className="h-72 rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[180px]">Module</TableHead>
                                            {permissionActions.map(action => <TableHead key={action}>{action}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {permissionModules.map((module) => (
                                            <TableRow key={module.name}>
                                                <TableCell className="font-medium">{module.name}</TableCell>
                                                {permissionActions.map(action => (
                                                    <TableCell key={action} className="text-center">
                                                        {module.permissions.includes(action) ? (
                                                            <FormField
                                                                control={editRoleForm.control}
                                                                name="permissions"
                                                                render={({ field }) => {
                                                                    const permissionString = `${module.name}:${action}`;
                                                                    return (
                                                                        <FormItem className="flex items-center justify-center">
                                                                        <FormControl>
                                                                            <Checkbox
                                                                                checked={field.value?.includes(permissionString)}
                                                                                onCheckedChange={(checked) => {
                                                                                    return checked
                                                                                        ? field.onChange([...field.value, permissionString])
                                                                                        : field.onChange(field.value?.filter((value) => value !== permissionString))
                                                                                }}
                                                                            />
                                                                        </FormControl>
                                                                        </FormItem>
                                                                    )
                                                                }}
                                                            />
                                                        ) : null}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                </ScrollArea>
                                <FormMessage className="pt-2">{editRoleForm.formState.errors.permissions?.message}</FormMessage>
                            </FormItem>
                        )}
                    />
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setEditingRole(null)}>Cancel</Button>
                        <Button type="submit">Save Changes</Button>
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
              This action cannot be undone. This will permanently delete the 
              <span className="font-semibold"> {roleToDelete?.name} </span> 
              role.
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
