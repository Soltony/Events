
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, passwordChangeRequired } = useAuth();

  useEffect(() => {
    // If loading is finished and user is not authenticated, redirect to login.
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
    
    // If password change is required, redirect to profile page, unless already there.
    if (!isLoading && isAuthenticated && passwordChangeRequired && pathname !== '/dashboard/profile') {
        router.replace('/dashboard/profile');
    }
  }, [router, isAuthenticated, isLoading, passwordChangeRequired, pathname]);

  // While loading auth state or if not authenticated (and about to be redirected),
  // show a loading skeleton to prevent flashing the protected content.
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

  // If authenticated, render the children.
  return <>{children}</>;
}
