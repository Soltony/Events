
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
    return <Skeleton className="h-10 w-full rounded-md" />;
  }

  if (isAuthenticated) {
    // We only show UserNav on non-dashboard pages from here.
    return <UserNav />;
  }

  return (
    <Button asChild className="w-full">
      <Link href="/login">Organizer Login</Link>
    </Button>
  );
}
