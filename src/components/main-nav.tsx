
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Ticket, PlusCircle, LineChart, Settings, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MainNav() {
  const pathname = usePathname();
  const isManagingEvents = (pathname === '/dashboard/events' || pathname.startsWith('/dashboard/events/')) && pathname !== '/dashboard/events/new';

  return (
    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
      <Link
        href="/dashboard"
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-accent-foreground hover:bg-sidebar-accent',
          pathname === '/dashboard' && 'bg-sidebar-accent text-sidebar-accent-foreground'
        )}
      >
        <Home className="h-4 w-4" />
        Dashboard
      </Link>
      
      <Link
        href="/dashboard/scan"
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-accent-foreground hover:bg-sidebar-accent',
          pathname === '/dashboard/scan' && 'bg-sidebar-accent text-sidebar-accent-foreground'
        )}
      >
        <QrCode className="h-4 w-4" />
        Scan QR
      </Link>

      <Link
        href="/dashboard/events/new"
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-accent-foreground hover:bg-sidebar-accent',
          pathname === '/dashboard/events/new' && 'bg-sidebar-accent text-sidebar-accent-foreground'
        )}
      >
        <PlusCircle className="h-4 w-4" />
        Create Event
      </Link>
      
      <Link
        href="/dashboard/events"
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-accent-foreground hover:bg-sidebar-accent',
          isManagingEvents && 'bg-sidebar-accent text-sidebar-accent-foreground'
        )}
      >
        <Ticket className="h-4 w-4" />
        Manage Events
      </Link>
      
      <Link
        href="/dashboard/reports"
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-accent-foreground hover:bg-sidebar-accent',
          pathname === '/dashboard/reports' && 'bg-sidebar-accent text-sidebar-accent-foreground'
        )}
      >
        <LineChart className="h-4 w-4" />
        Reports
      </Link>
      <Link
        href="/dashboard/settings"
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-accent-foreground hover:bg-sidebar-accent',
          pathname === '/dashboard/settings' && 'bg-sidebar-accent text-sidebar-accent-foreground'
        )}
      >
        <Settings className="h-4 w-4" />
        Settings
      </Link>
    </nav>
  );
}
