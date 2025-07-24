
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Ticket, PlusCircle, LineChart, Settings, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

export function MainNav() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const navItems = [
    { href: "/dashboard", icon: <Home className="h-4 w-4" />, label: "Dashboard", active: pathname === '/dashboard' },
    { href: "/dashboard/scan", icon: <QrCode className="h-4 w-4" />, label: "Scan QR", active: pathname === '/dashboard/scan' },
    { href: "/dashboard/events/new", icon: <PlusCircle className="h-4 w-4" />, label: "Create Event", active: pathname === '/dashboard/events/new' },
    { href: "/dashboard/events", icon: <Ticket className="h-4 w-4" />, label: "Manage Events", active: (pathname === '/dashboard/events' || pathname.startsWith('/dashboard/events/')) && pathname !== '/dashboard/events/new' },
    { href: "/dashboard/reports", icon: <LineChart className="h-4 w-4" />, label: "Reports", active: pathname === '/dashboard/reports' },
    { href: "/dashboard/settings", icon: <Settings className="h-4 w-4" />, label: "Settings", active: pathname.startsWith('/dashboard/settings') },
  ];

  return (
    <TooltipProvider>
      <nav className={cn("grid items-start text-sm font-medium", isCollapsed ? 'px-2' : 'px-2 lg:px-4')}>
        {navItems.map(item => (
          isCollapsed ? (
            <Tooltip key={item.href} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground transition-colors hover:text-sidebar-accent-foreground hover:bg-sidebar-accent md:h-8 md:w-8',
                    item.active && 'bg-sidebar-accent text-sidebar-accent-foreground'
                  )}
                >
                  {item.icon}
                  <span className="sr-only">{item.label}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-sidebar-accent-foreground hover:bg-sidebar-accent',
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
