
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
import { useRouter } from 'next/navigation';
import { UserPlus, ArrowLeft, Pencil } from 'lucide-react';
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from '@/components/ui/skeleton';
import { getUsersAndRoles, updateUserRole, updateUserStatus } from '@/lib/actions';
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
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id={`status-switch-${user.id}`}
                                        checked={user.status === 'ACTIVE'}
                                        onCheckedChange={(checked) => handleStatusChange(user.id, checked ? 'ACTIVE' : 'INACTIVE')}
                                        disabled={!canChangeStatus}
                                    />
                                    <Badge variant="outline" className={cn(user.status === 'ACTIVE' ? "border-green-500 text-green-700" : "border-red-500 text-red-700")}>
                                        {user.status}
                                    </Badge>
                                </div>
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
