
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

const roleHierarchy: Record<string, number> = {
    'Admin': 3,
    'Sub-admin': 2,
    'Organizer': 1,
};


export default function UserManagementPage() {
    const { toast } = useToast();
    const router = useRouter();
    const { user: currentUser, hasPermission } = useAuth();
    const [users, setUsers] = useState<UserWithRole[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);

    const currentUserRoleRank = currentUser?.role?.name ? (roleHierarchy[currentUser.role.name] || 0) : 0;
    
    const canManageUser = (targetUser: UserWithRole): boolean => {
        if (!currentUser?.role?.name) return false;
        
        // Prevent users from managing themselves, ever. Admin exception is handled on the component level.
        if (targetUser.id === currentUser.id) return false;
        
        // No one can manage an Admin
        if (targetUser.role?.name === 'Admin') return false; 

        const targetUserRoleRank = roleHierarchy[targetUser.role.name] || 0;
        return currentUserRoleRank > targetUserRoleRank;
    }


    const fetchData = async () => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        try {
            !loading && setLoading(true);
            const { users: allUsers, roles: allRoles } = await getUsersAndRoles();
            
            // Filter users based on current user's role
            const filteredUsers = currentUser.role.name === 'Admin'
                ? allUsers
                : allUsers.filter(user => user.role.name !== 'Admin');

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
        if (!canManageUser(user)) {
            toast({ variant: 'destructive', title: 'Action Denied', description: 'You do not have permission to delete this user.' });
            return;
        }

        try {
            await deleteUser(user.id, user.phoneNumber);
            toast({ title: 'User Deleted', description: `${user.firstName} ${user.lastName} has been removed.`});
            fetchData(); // Refresh the list
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to delete user.' });
        }
    };

  return (
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
                            const isManageable = canManageUser(user);
                            const canUpdate = hasPermission('User Management:Update');
                            const canDelete = hasPermission('User Management:Delete');
                            const canEditSelf = user.id === currentUser?.id && canUpdate;

                            return (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.firstName} {user.lastName}</TableCell>
                                    <TableCell>{user.phoneNumber}</TableCell>
                                    <TableCell>
                                        <Select 
                                            value={user.roleId ?? ''} 
                                            onValueChange={(newRoleId) => handleRoleChange(user.id, newRoleId)}
                                            disabled={!isManageable || !canUpdate || user.role.name === 'Admin'}
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
                                                <Button variant="ghost" size="icon" asChild disabled={!isManageable && !canEditSelf}>
                                                    <Link href={`/dashboard/settings/users/${user.id}/edit`}>
                                                        <Pencil className="h-4 w-4" />
                                                        <span className="sr-only">Edit</span>
                                                    </Link>
                                                </Button>
                                            )}
                                            {canDelete && (
                                                <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" disabled={!isManageable}>
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
  );
}
