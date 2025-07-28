
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';
import { toast } from '@/hooks/use-toast';

const pagePermissions: Record<string, string | string[]> = {
    '/dashboard': 'Dashboard:Read',
    '/dashboard/scan': 'Scan QR:Read',
    '/dashboard/events': 'Events:Read',
    '/dashboard/events/new': 'Events:Create',
    '/dashboard/events/[id]': 'Events:Read',
    '/dashboard/events/[id]/edit': 'Events:Update',
    '/dashboard/reports': 'Reports:Read',
    '/dashboard/settings': ['User Registration:Read', 'User Management:Read', 'Role Management:Read'],
    '/dashboard/settings/users': 'User Management:Read',
    '/dashboard/settings/users/new': 'User Registration:Create',
    '/dashboard/settings/users/[id]/edit': 'User Management:Update',
    '/dashboard/settings/roles': 'Role Management:Read',
    '/dashboard/settings/roles/new': 'Role Management:Create',
    '/dashboard/settings/roles/edit': 'Role Management:Update',
};

function hasAccess(pathname: string, hasPermission: (p: string) => boolean): boolean {
    const checkPermission = (p: string | string[]): boolean => {
        if (Array.isArray(p)) {
            return p.some(perm => hasPermission(perm));
        }
        return hasPermission(p);
    };

    // Exact match
    const requiredPermission = Object.keys(pagePermissions).find(key => {
         if (key.includes('[')) {
            const regex = new RegExp(`^${key.replace(/\[.*?\]/g, '[^/]+')}$`);
            return regex.test(pathname);
        }
        return key === pathname;
    });

    if (requiredPermission) {
        return checkPermission(pagePermissions[requiredPermission]);
    }
    
    // Allow access to pages not in the list, like the profile page
    return true;
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    // Force password change if required
    if (user?.passwordChangeRequired && pathname !== '/dashboard/profile') {
        router.replace('/dashboard/profile');
        return;
    }
    
    if (!hasAccess(pathname, hasPermission)) {
        // If user does not have permission, redirect to their default page
        // You can define a more sophisticated logic here if needed
        toast({
            variant: 'destructive',
            title: 'Access Denied',
            description: "You don't have permission to view this page.",
        });
        router.replace('/dashboard');
    }

  }, [router, isAuthenticated, isLoading, pathname, hasPermission, user]);

  if (isLoading || !isAuthenticated) {
    return (
        <div className="p-4 lg:p-6">
            <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
                <Skeleton className="h-64 w-full" />
            </div>
        </div>
    )
  }
  
  if (!hasAccess(pathname, hasPermission)) {
       return (
        <div className="p-4 lg:p-6 flex justify-center items-center h-full">
            <p>Redirecting...</p>
        </div>
    )
  }

  // Render children only if user is authenticated and has permission
  if (user?.passwordChangeRequired && pathname !== '/dashboard/profile') {
     return (
        <div className="p-4 lg:p-6">
            <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
                <Skeleton className="h-64 w-full" />
            </div>
        </div>
    )
  }

  return <>{children}</>;
}
