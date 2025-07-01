
'use client';

import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { Logo } from './logo';
import { Button } from './ui/button';
import { UserNav } from './user-nav';
import { Skeleton } from './ui/skeleton';

export function PublicHeader() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6">
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <Logo />
        <span className="">EventFlow</span>
      </Link>
      <div className="w-full flex-1">
        {/* Future Search bar can go here */}
      </div>
      <div className="flex items-center">
        {isLoading ? (
          <Skeleton className="h-9 w-28 rounded-md" />
        ) : isAuthenticated ? (
          <UserNav />
        ) : (
          <Button asChild>
            <Link href="/login">Organizer Login</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
