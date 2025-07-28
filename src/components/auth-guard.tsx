
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';

const pagePermissions: Record<string, string> = {
    '/dashboard': 'Dashboard:View',
    '/dashboard/scan': 'Scan QR:View',
    '/dashboard/events': 'Events:View',
    '/dashboard/events/new': 'Events:Create',
    '/dashboard/reports': 'Reports:View',
    '/dashboard/settings': 'Settings:View',
};

function hasAccess(pathname: string, hasPermission: (p: string) => boolean): boolean {
    if (pathname.startsWith('/dashboard/events/') && pathname.includes('/edit')) {
        return hasPermission('Events:Update');
    }
    if (pathname.startsWith('/dashboard/events/')) {
        return hasPermission('Events:View');
    }
    const requiredPermission = Object.keys(pagePermissions).find(key => pathname.startsWith(key));
    if (requiredPermission) {
        return hasPermission(pagePermissions[requiredPermission]);
    }
    // Allow access to pages not in the list, like the profile page or settings subpages which have their own logic
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

    if (!hasAccess(pathname, hasPermission)) {
        // If user does not have permission, redirect to their default page
        switch(user?.role?.name) {
            case 'Organizer':
                router.replace('/dashboard/events');
                break;
            default: // Admin and any other roles without a specific rule
                router.replace('/dashboard');
                break;
        }
    }

  }, [router, isAuthenticated, isLoading, pathname, hasPermission, user]);

  if (isLoading || !isAuthenticated || (isAuthenticated && !hasAccess(pathname, hasPermission))) {
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
