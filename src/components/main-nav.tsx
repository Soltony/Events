
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Ticket, PlusCircle, LineChart, Settings, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/context/auth-context';

export function MainNav() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const { hasPermission } = useAuth();
  const isCollapsed = state === 'collapsed';

  const navItems = [
    { href: "/dashboard", icon: <Home className="h-5 w-5" />, label: "Dashboard", active: pathname === '/dashboard', permission: 'Dashboard:Read' },
    { href: "/dashboard/scan", icon: <QrCode className="h-5 w-5" />, label: "Scan QR", active: pathname === '/dashboard/scan', permission: 'Scan QR:Read' },
    { href: "/dashboard/events/new", icon: <PlusCircle className="h-5 w-5" />, label: "Create Event", active: pathname === '/dashboard/events/new', permission: 'Events:Create' },
    { href: "/dashboard/events", icon: <Ticket className="h-5 w-5" />, label: "Manage Events", active: (pathname === '/dashboard/events' || pathname.startsWith('/dashboard/events/')) && pathname !== '/dashboard/events/new', permission: 'Events:Read' },
    { href: "/dashboard/reports", icon: <LineChart className="h-5 w-5" />, label: "Reports", active: pathname === '/dashboard/reports', permission: 'Reports:Read' },
    { href: "/dashboard/settings", icon: <Settings className="h-5 w-5" />, label: "Settings", active: pathname.startsWith('/dashboard/settings'), permission: ['User Registration:Read', 'User Management:Read', 'Role Management:Read'] },
  ];
  
  const hasAnyPermission = (permissions: string | string[]) => {
      if (Array.isArray(permissions)) {
          return permissions.some(p => hasPermission(p));
      }
      return hasPermission(permissions);
  }

  const visibleNavItems = navItems.filter(item => hasAnyPermission(item.permission));

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
                    'flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    item.active && 'bg-sidebar-accent text-sidebar-accent-foreground'
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
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                item.active && 'bg-sidebar-accent text-sidebar-accent-foreground'
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
