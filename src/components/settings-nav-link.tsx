
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SETTINGS_NAV_ITEMS } from '@/lib/settings-nav-items';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface SettingsNavLinkProps {
  /** Portal prefix, e.g. '/super-admin' or '/dashboard'. */
  basePath: string;
  hasPermission: (permission: string) => boolean;
  /** Icon-rail mode (collapsed sidebar): render an icon-only tooltip link. */
  collapsedRail?: boolean;
}

export function SettingsNavLink({ basePath, hasPermission, collapsedRail }: SettingsNavLinkProps) {
  const pathname = usePathname();

  const visible = SETTINGS_NAV_ITEMS.some((item) => hasPermission(item.permission));
  if (!visible) {
    return null;
  }

  const settingsHref = `${basePath}/settings`;
  const isActive =
    pathname.startsWith(settingsHref) ||
    SETTINGS_NAV_ITEMS.some((item) => pathname.startsWith(`${basePath}${item.path}`));

  if (collapsedRail) {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Link
              href={settingsHref}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-foreground transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
              )}
            >
              <Settings className="h-5 w-5" />
              <span className="sr-only">Settings</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-sidebar-accent text-sidebar-accent-foreground border-none">
            Settings
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Link
      href={settingsHref}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
      )}
    >
      <Settings className="h-5 w-5" />
      Settings
    </Link>
  );
}
