
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Ticket, PlusCircle, LineChart, Settings } from 'lucide-react';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';

export function MainNav() {
  const pathname = usePathname();
  const isManagingEvents = (pathname === '/dashboard/events' || pathname.startsWith('/dashboard/events/')) && pathname !== '/dashboard/events/new';

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: Home, isActive: pathname === '/dashboard' },
    { href: "/dashboard/events/new", label: "Create Event", icon: PlusCircle, isActive: pathname === '/dashboard/events/new' },
    { href: "/dashboard/events", label: "Manage Events", icon: Ticket, isActive: isManagingEvents },
    { href: "/dashboard/reports", label: "Reports", icon: LineChart, isActive: pathname === '/dashboard/reports' },
    { href: "/dashboard/settings", label: "Settings", icon: Settings, isActive: pathname === '/dashboard/settings' },
  ];

  return (
    <SidebarMenu className="px-2 lg:px-4">
      {navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            isActive={item.isActive}
            tooltip={item.label}
          >
            <Link href={item.href}>
              <item.icon />
              <span>{item.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
