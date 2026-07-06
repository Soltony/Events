
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Ticket, PlusCircle, LineChart, QrCode, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/context/auth-context';

export const navItems = [
    { href: "/dashboard", icon: <Home className="h-5 w-5" />, label: "Dashboard", permission: 'Dashboard:Access' },
    { href: "/dashboard/scan", icon: <QrCode className="h-5 w-5" />, label: "Scan QR", permission: 'Scan QR:Access' },
    { href: "/dashboard/events/new", icon: <PlusCircle className="h-5 w-5" />, label: "Create Event", permission: 'Events:Create' },
    { href: "/dashboard/events", icon: <Ticket className="h-5 w-5" />, label: "Manage Events", permission: ['Events:Read', 'Events:Update', 'Events:Delete'] },
    { href: "/dashboard/reports", icon: <LineChart className="h-5 w-5" />, label: "Reports", permission: 'Reports:Access' },
    { href: "/dashboard/users/new", icon: <UserPlus className="h-5 w-5" />, label: "Register User", permission: 'Users:Create' },
];

export function MainNav() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const { hasPermission } = useAuth();
  const isCollapsed = state === 'collapsed';

  const hasAnyPermission = (permissions: string | string[]) => {
      if (Array.isArray(permissions)) {
          return permissions.some(p => hasPermission(p));
      }
      return hasPermission(permissions);
  }

  const visibleNavItems = navItems.filter(item => hasAnyPermission(item.permission));

  const isRouteActive = (href: string) => {
    if (href === '/dashboard/events') {
      return (pathname === '/dashboard/events' || pathname.startsWith('/dashboard/events/')) && pathname !== '/dashboard/events/new';
    }
    return pathname === href;
  }

  return (
    <TooltipProvider>
      <nav className={cn("grid items-start text-base font-medium", isCollapsed ? 'px-2' : 'px-4')}>
        {visibleNavItems.map(item => (
          isCollapsed ? (
            <Tooltip key={item.href} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-foreground transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    isRouteActive(item.href) && 'bg-sidebar-accent text-sidebar-accent-foreground'
                  )}
                >
                  {item.icon}
                  <span className="sr-only">{item.label}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-sidebar-accent text-sidebar-accent-foreground border-none">
                {item.label}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isRouteActive(item.href) && 'bg-sidebar-accent text-sidebar-accent-foreground'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        ))}
      </nav>
    </TooltipProvider>
  );
}
