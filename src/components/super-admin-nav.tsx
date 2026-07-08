
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building, Map, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSuperAdminAuth } from '@/context/super-admin-auth-context';

const navItems = [
  { href: '/super-admin/dashboard', icon: <LayoutDashboard className="h-5 w-5" />, label: 'Overview', permission: 'Performance:Access' },
  { href: '/super-admin/branches', icon: <Building className="h-5 w-5" />, label: 'Branch Comparison', permission: 'Performance:Access' },
  { href: '/super-admin/districts', icon: <Map className="h-5 w-5" />, label: 'District Comparison', permission: 'Performance:Access' },
  { href: '/super-admin/settings', icon: <Settings className="h-5 w-5" />, label: 'Settings', permission: ['Users:Read', 'Roles:Read', 'Staff:Read', 'Organization:Read', 'Homepage Carousel:Read'] },
];

export function SuperAdminNav() {
  const pathname = usePathname();
  const { hasPermission } = useSuperAdminAuth();

  const hasAnyPermission = (permission: string | string[]) => {
    if (Array.isArray(permission)) {
      return permission.some((p) => hasPermission(p));
    }
    return hasPermission(permission);
  };

  const visibleNavItems = navItems.filter((item) => hasAnyPermission(item.permission));

  const isRouteActive = (href: string) => {
    if (href === '/super-admin/settings') {
      return pathname.startsWith('/super-admin/settings') ||
        ['/super-admin/users', '/super-admin/roles', '/super-admin/staff', '/super-admin/organization', '/super-admin/homeads']
          .some((prefix) => pathname.startsWith(prefix));
    }
    return pathname === href;
  };

  return (
    <nav className="grid items-start gap-1 px-4 text-base font-medium">
      {visibleNavItems.map((item) => (
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
      ))}
    </nav>
  );
}
