
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Ticket, PlusCircle, LineChart } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MainNav() {
  const pathname = usePathname();
  const isManagingEvents = (pathname === '/dashboard/events' || pathname.startsWith('/dashboard/events/')) && pathname !== '/dashboard/events/new';

  return (
    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
      <Link
        href="/dashboard"
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
          pathname === '/dashboard' && 'bg-muted text-primary'
        )}
      >
        <Home className="h-4 w-4" />
        Dashboard
      </Link>

      <Link
        href="/dashboard/events/new"
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
          pathname === '/dashboard/events/new' && 'bg-muted text-primary'
        )}
      >
        <PlusCircle className="h-4 w-4" />
        Create Event
      </Link>
      
      <Link
        href="/dashboard/events"
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
          isManagingEvents && 'bg-muted text-primary'
        )}
      >
        <Ticket className="h-4 w-4" />
        Manage Events
      </Link>
      
      <Link
        href="/dashboard/reports"
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
          pathname === '/dashboard/reports' && 'bg-muted text-primary'
        )}
      >
        <LineChart className="h-4 w-4" />
        Reports
      </Link>
    </nav>
  );
}
