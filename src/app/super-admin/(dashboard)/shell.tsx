
'use client';

import { useSidebar, SidebarTrigger } from '@/components/ui/sidebar';
import { SuperAdminHeader } from '@/components/super-admin-header';
import { cn } from '@/lib/utils';

export default function SuperAdminDashboardShell({ children }: { children: React.ReactNode }) {
  const { state } = useSidebar();
  return (
    <div
      className={cn(
        'flex flex-col flex-1 overflow-hidden transition-all duration-300 ease-in-out',
        state === 'expanded' ? 'md:ml-64' : 'md:ml-14'
      )}
    >
      <SuperAdminHeader />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
