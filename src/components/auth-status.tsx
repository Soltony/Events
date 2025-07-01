
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

  if (isDashboardPage) {
    return null;
  }
  
  if (isLoading) {
    return <Skeleton className="h-10 w-28 rounded-md" />;
  }

  if (isAuthenticated) {
    return <UserNav />;
  }

  return (
    <Button asChild>
      <Link href="/login">Organizer Login</Link>
    </Button>
  );
}
