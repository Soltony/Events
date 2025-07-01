"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MainNav() {
  const pathname = usePathname();

  const routes = [
    { href: '/', label: 'Dashboard', icon: Home, active: pathname === '/' },
    { href: '/events/1', label: 'Manage Event', icon: Ticket, active: pathname.startsWith('/events') },
  ];

  return (
    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
      {routes.map((route) => (
        <Link
          key={route.href}
          href={route.href}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
            route.active && 'bg-muted text-primary'
          )}
        >
          <route.icon className="h-4 w-4" />
          {route.label}
        </Link>
      ))}
    </nav>
  );
}
