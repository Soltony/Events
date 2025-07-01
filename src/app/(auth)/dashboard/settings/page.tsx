
'use client';

import { useState } from 'react';
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
import { Badge } from "@/components/ui/badge";
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
  FormDescription,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { PlusCircle } from 'lucide-react';
import { mockUsers, mockRoles } from '@/lib/mock-data';
import { useToast } from "@/hooks/use-toast"

const addUserFormSchema = z.object({
  name: z.string().min(1, { message: "Name is required." }),
  email: z.string().email({ message: "Please enter a valid email." }),
  role: z.string({ required_error: "Please select a role." }),
});

type AddUserFormValues = z.infer<typeof addUserFormSchema>;

const allPermissions = ['All Permissions', 'Create Events', 'Edit Events', 'View Reports', 'Manage Attendees', 'View Attendees', 'Check-in Attendees'];

const createRoleFormSchema = z.object({
    name: z.string().min(1, { message: "Role name is required." }),
    permissions: z.array(z.string()).refine((value) => value.some((item) => item), {
        message: "You have to select at least one permission.",
    }),
});

type CreateRoleFormValues = z.infer<typeof createRoleFormSchema>;

export default function SettingsPage() {
    const { toast } = useToast();
    const [users, setUsers] = useState(mockUsers);
    const [roles, setRoles] = useState(mockRoles);
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);

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

    const createRoleForm = useForm<CreateRoleFormValues>({
        resolver: zodResolver(createRoleFormSchema),
        defaultValues: {
            name: "",
            permissions: [],
        },
    });

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

    function onCreateRoleSubmit(data: CreateRoleFormValues) {
        const newRole = {
            id: `role-${Math.random().toString(36).substring(2, 9)}`,
            name: data.name,
            permissions: data.permissions,
        };
        setRoles([...roles, newRole]);
        toast({
            title: "Role Created",
            description: `Successfully created the ${data.name} role.`,
        });
        setIsCreateRoleOpen(false);
        createRoleForm.reset();
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
                      <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                              <DialogTitle>Create New Role</DialogTitle>
                              <DialogDescription>
                                  Define a new role and set its permissions.
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
                                                <div className="space-y-2">
                                                {allPermissions.map((permission) => (
                                                    <FormField
                                                        key={permission}
                                                        control={createRoleForm.control}
                                                        name="permissions"
                                                        render={({ field }) => {
                                                            return (
                                                                <FormItem
                                                                    key={permission}
                                                                    className="flex flex-row items-start space-x-3 space-y-0"
                                                                >
                                                                    <FormControl>
                                                                        <Checkbox
                                                                            checked={field.value?.includes(permission)}
                                                                            onCheckedChange={(checked) => {
                                                                                const updatedPermissions = checked
                                                                                    ? [...field.value, permission]
                                                                                    : field.value?.filter(
                                                                                        (value) => value !== permission
                                                                                    );
                                                                                field.onChange(updatedPermissions);
                                                                            }}
                                                                        />
                                                                    </FormControl>
                                                                    <FormLabel className="font-normal">
                                                                        {permission}
                                                                    </FormLabel>
                                                                </FormItem>
                                                            )
                                                        }}
                                                    />
                                                ))}
                                                </div>
                                                <FormMessage />
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
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Role</TableHead>
                                <TableHead>Permissions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {roles.map((role) => (
                                <TableRow key={role.id}>
                                    <TableCell className="font-medium">{role.name}</TableCell>
                                    <TableCell className="space-x-1 space-y-1">
                                        {role.permissions.map(permission => (
                                            <Badge key={permission} variant={role.name === 'Admin' ? 'default' : 'secondary'}>
                                                {permission}
                                            </Badge>
                                        ))}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
