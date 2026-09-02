
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building, Map, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSuperAdminAuth } from '@/context/super-admin-auth-context';
import { SettingsNavLink } from '@/components/settings-nav-link';

const topNavItems = [
  { href: '/super-admin/dashboard', icon: <LayoutDashboard className="h-5 w-5" />, label: 'Overview', permission: 'Performance:Overview' },
  { href: '/super-admin/branches', icon: <Building className="h-5 w-5" />, label: 'Branch Comparison', permission: 'Performance:Branch Comparison' },
  { href: '/super-admin/districts', icon: <Map className="h-5 w-5" />, label: 'District Comparison', permission: 'Performance:District Comparison' },
  { href: '/super-admin/organizer-approvals', icon: <ClipboardCheck className="h-5 w-5" />, label: 'Organizer Approvals', permission: 'Organizer Approvals:Access' },
];

export function SuperAdminNav() {
  const pathname = usePathname();
  const { hasPermission } = useSuperAdminAuth();

  const visibleTopItems = topNavItems.filter((item) => hasPermission(item.permission));

  return (
    <nav className="grid items-start gap-1 px-4 text-base font-medium">
      {visibleTopItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            pathname === item.href && 'bg-sidebar-accent text-sidebar-accent-foreground'
          )}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}

      <SettingsNavLink basePath="/super-admin" hasPermission={hasPermission} />
    </nav>
  );
}
