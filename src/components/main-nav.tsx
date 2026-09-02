
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Ticket, PlusCircle, LineChart, QrCode, Gauge, Building, Map, ClipboardCheck, CalendarCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/context/auth-context';
import { SettingsNavLink } from '@/components/settings-nav-link';

export const navItems = [
    { href: "/dashboard", icon: <Home className="h-5 w-5" />, label: "Dashboard", permission: 'Dashboard:Access' },
    { href: "/dashboard/scan", icon: <QrCode className="h-5 w-5" />, label: "Scan QR", permission: 'Scan QR:Access' },
    { href: "/dashboard/events/new", icon: <PlusCircle className="h-5 w-5" />, label: "Create Event", permission: 'Events:Create' },
    { href: "/dashboard/events", icon: <Ticket className="h-5 w-5" />, label: "Manage Events", permission: ['Events:Read', 'Events:Update', 'Events:Delete'] },
    { href: "/dashboard/event-approvals", icon: <CalendarCheck className="h-5 w-5" />, label: "Event Approvals", permission: 'Event Approvals:Access' },
    { href: "/dashboard/organizer-approvals", icon: <ClipboardCheck className="h-5 w-5" />, label: "Organizer Approvals", permission: 'Organizer Approvals:Access' },
    { href: "/dashboard/reports", icon: <LineChart className="h-5 w-5" />, label: "Reports", permission: 'Reports:Access' },
    { href: "/dashboard/performance/overview", icon: <Gauge className="h-5 w-5" />, label: "Overview", permission: 'Performance:Overview' },
    { href: "/dashboard/performance/branches", icon: <Building className="h-5 w-5" />, label: "Branch Comparison", permission: 'Performance:Branch Comparison' },
    { href: "/dashboard/performance/districts", icon: <Map className="h-5 w-5" />, label: "District Comparison", permission: 'Performance:District Comparison' },
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
        <SettingsNavLink basePath="/dashboard" hasPermission={hasPermission} collapsedRail={isCollapsed} />
      </nav>
    </TooltipProvider>
  );
}
