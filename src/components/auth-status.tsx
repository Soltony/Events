
'use client';

import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { Button } from './ui/button';
import { UserNav } from './user-nav';
import { Skeleton } from './ui/skeleton';
import { usePathname } from 'next/navigation';

export function AuthStatus() {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();

  const isDashboardPage = pathname.startsWith('/dashboard');

  // Do not render the component on dashboard pages, as UserNav is in the header there.
  if (isDashboardPage) {
    return null;
  }
  
  if (isLoading) {
    return <Skeleton className="h-10 w-32 rounded-full" />;
  }

  if (isAuthenticated) {
    // We only show UserNav on non-dashboard pages from here.
    return (
      <div className="flex items-center gap-2">
        <UserNav />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
        <Button asChild className="rounded-full">
          <Link href="/login">Organizer Login</Link>
        </Button>
    </div>
  );
}
