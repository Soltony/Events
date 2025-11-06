

'use client';

import { useState, useEffect } from 'react';
import type { User, Role, UserStatus } from '@prisma/client';
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from 'next/navigation';
import { UserPlus, ArrowLeft, MoreHorizontal, Edit, Trash2, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from '@/components/ui/skeleton';
import { getUsersAndRoles, updateUserRole, updateUserStatus, deleteUser } from '@/lib/actions';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [userToDelete, setUserToDelete] = useState<UserWithRole | null>(null);

    const fetchData = async () => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        try {
            !loading && setLoading(true);
            const { users: allUsers, roles: allRoles } = await getUsersAndRoles();
            
            const filteredUsers = allUsers.filter((user: UserWithRole) => {
                if (user.id === currentUser.id) {
                    return true;
                }
                
                if (currentUser.role.name !== 'Admin' && user.role.name === 'Admin') {
                    return false;
                }
                
                if (currentUser.role.name !== 'Admin' && user.role.name === currentUser.role.name) {
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

    const handleStatusChange = async (userId: string, newStatus: UserStatus) => {
        const oldUsers = [...users];
        const newUsers = users.map(user => user.id === userId ? { ...user, status: newStatus } : user);
        setUsers(newUsers);
        try {
            await updateUserStatus(userId, newStatus);
            toast({ title: 'User Status Updated', description: `User is now ${newStatus.toLowerCase()}.` });
        } catch (error) {
            setUsers(oldUsers);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update user status.' });
        }
    }
    
    const handleApproval = async (userId: string, newStatus: 'ACTIVE' | 'INACTIVE') => {
        setActionLoading(userId);
        try {
            await updateUserStatus(userId, newStatus);
            toast({ title: 'User status updated successfully.'});
            fetchData();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update user status.' });
        } finally {
            setActionLoading(null);
        }
    }

    const handleDelete = async () => {
        if (!userToDelete) return;
        try {
            await deleteUser(userToDelete.id, userToDelete.phoneNumber);
            toast({
                title: "User Deleted",
                description: `Successfully deleted ${userToDelete.firstName} ${userToDelete.lastName}.`
            });
            fetchData();
        } catch(error: any) {
             toast({
                variant: 'destructive',
                title: 'Error Deleting User',
                description: error.message || "An unexpected error occurred."
            });
        } finally {
            setUserToDelete(null);
        }
    }


  return (
    <>
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
                  <CardDescription>Assign roles and manage status for users in the system.</CardDescription>
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
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const canUpdate = hasPermission('User Management:Update');
                      const isSelf = user.id === currentUser?.id;
                      const isTargetAdmin = user.role?.name === 'Admin';
                      
                      const isEditable = (canUpdate && !isTargetAdmin) || isSelf;
                      const canChangeRole = canUpdate && !isSelf && !isTargetAdmin;
                      const canChangeStatus = canUpdate && !isSelf && !isTargetAdmin;
                      const canDelete = hasPermission('User Management:Delete') && !isSelf && !isTargetAdmin;

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
                           <TableCell>
                            {user.status === 'PENDING' && canUpdate ? (
                                <div className="flex items-center gap-2">
                                     <Button size="sm" variant="outline" onClick={() => handleApproval(user.id, 'ACTIVE')} disabled={actionLoading === user.id}>
                                        {actionLoading === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => handleApproval(user.id, 'INACTIVE')} disabled={actionLoading === user.id}>
                                         {actionLoading === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                    </Button>
                                    <Badge variant="outline" className="border-yellow-500 text-yellow-700">PENDING</Badge>
                                </div>
                            ) : (
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id={`status-switch-${user.id}`}
                                        checked={user.status === 'ACTIVE'}
                                        onCheckedChange={(checked) => handleStatusChange(user.id, checked ? 'ACTIVE' : 'INACTIVE')}
                                        disabled={!canChangeStatus}
                                    />
                                    <Badge variant="outline" className={cn(
                                        user.status === 'ACTIVE' && "border-green-500 text-green-700",
                                        user.status === 'INACTIVE' && "border-red-500 text-red-700",
                                        user.status === 'PENDING' && "border-yellow-500 text-yellow-700"
                                    )}>
                                        {user.status}
                                    </Badge>
                                </div>
                            )}
                            </TableCell>
                          <TableCell className="text-right">
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" disabled={!isEditable && !canDelete}>
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {isEditable && (
                                        <DropdownMenuItem onSelect={() => router.push(`/dashboard/settings/users/${user.id}/edit`)}>
                                            <Edit className="mr-2 h-4 w-4" /> Edit
                                        </DropdownMenuItem>
                                    )}
                                    {canDelete && (
                                        <DropdownMenuItem
                                            className="text-destructive"
                                            onSelect={() => setUserToDelete(user)}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
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
    <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete the user strong>{userToDelete?.firstName} {userToDelete?.lastName}</strong>. This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                    Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
