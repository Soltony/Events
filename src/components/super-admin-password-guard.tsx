
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useSuperAdminAuth } from '@/context/super-admin-auth-context';

export default function SuperAdminPasswordGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { superAdmin, isLoading } = useSuperAdminAuth();

  const mustChangePassword = !!superAdmin?.passwordChangeRequired && pathname !== '/super-admin/profile';

  useEffect(() => {
    if (!isLoading && mustChangePassword) {
      router.replace('/super-admin/profile');
    }
  }, [isLoading, mustChangePassword, router]);

  if (isLoading || mustChangePassword) {
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
    );
  }

  return <>{children}</>;
}
