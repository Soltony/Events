
'use client';

import { useState, useEffect } from 'react';
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
import { useRouter } from 'next/navigation';
import { UserPlus, ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from '@/components/ui/skeleton';
import { getUsersAndRoles, updateUserRole, deleteUser } from '@/lib/actions';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from '@/context/auth-context';

interface UserWithRole extends User {
    role: Role;
}

export default function UserManagementPage() {
    const { toast } = useToast();
    const router = useRouter();
    const { user: currentUser, hasPermission } = useAuth();
    const [users, setUsers] = useState<UserWithRole[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        try {
            !loading && setLoading(true);
            const { users: allUsers, roles: allRoles } = await getUsersAndRoles();
            
            const filteredUsers = allUsers.filter(user => {
                // The current user should always see themselves.
                if (user.id === currentUser.id) {
                    return true;
                }
                
                // Hide Admins from non-Admins
                if (currentUser.role.name !== 'Admin' && user.role.name === 'Admin') {
                    return false;
                }
                
                // Hide users with the same role (peers)
                if (user.role.name === currentUser.role.name) {
                    return false;
                }

                return true;
            });

            setUsers(filteredUsers);
            setRoles(allRoles.filter((role: Role) => role.name !== 'Admin')); 
        } catch (error) {
            console.error("Failed to fetch settings data:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load users and roles.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentUser]);

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

    const handleDeleteUser = async (user: UserWithRole) => {
        try {
            await deleteUser(user.id, user.phoneNumber);
            toast({ title: 'User Deleted', description: `${user.firstName} ${user.lastName} has been removed.`});
            fetchData();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to delete user.' });
        }
    };

  return (
    <div className="flex flex-1 justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="flex flex-1 flex-col gap-4 md:gap-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
              <p className="text-muted-foreground">
                View and manage existing user accounts and their roles.
              </p>
            </div>
          </div>
          {loading ? (
            <Card>
              <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
              <CardContent><Skeleton className="h-40 w-full" /></CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>All Users</CardTitle>
                  <CardDescription>Assign roles to users in the system.</CardDescription>
                </div>
                {hasPermission('User Registration:Create') && (
                  <Button asChild style={{ backgroundColor: '#FBBF24', color: '#422006' }}>
                    <Link href="/dashboard/settings/users/new">
                      <UserPlus className="mr-2 h-4 w-4" /> Add User
                    </Link>
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone Number</TableHead>
                      <TableHead className="w-[180px]">Role</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const canUpdate = hasPermission('User Management:Update');
                      const canDelete = hasPermission('User Management:Delete');
                      
                      const isSelf = user.id === currentUser?.id;
                      const isTargetAdmin = user.role?.name === 'Admin';
                      
                      const isEditable = (canUpdate && !isTargetAdmin) || isSelf;
                      const isDeletable = canDelete && !isSelf && !isTargetAdmin;
                      
                      const canChangeRole = canUpdate && !isSelf && !isTargetAdmin;

                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.firstName} {user.lastName}</TableCell>
                          <TableCell>{user.phoneNumber}</TableCell>
                          <TableCell>
                            <Select
                              value={user.roleId ?? ''}
                              onValueChange={(newRoleId) => handleRoleChange(user.id, newRoleId)}
                              disabled={!canChangeRole}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={user.role?.name || "Select role"} />
                              </SelectTrigger>
                              <SelectContent>{roles.map((role) => (<SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>))}</SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {canUpdate && (
                                <Button variant="ghost" size="icon" asChild disabled={!isEditable}>
                                  <Link href={`/dashboard/settings/users/${user.id}/edit`}>
                                    <Pencil className="h-4 w-4" />
                                    <span className="sr-only">Edit</span>
                                  </Link>
                                </Button>
                              )}
                              {canDelete && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" disabled={!isDeletable}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                      <span className="sr-only">Delete</span>
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the user <strong>{user.firstName} {user.lastName}</strong> and all associated data.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteUser(user)} className="bg-destructive hover:bg-destructive/90">
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
