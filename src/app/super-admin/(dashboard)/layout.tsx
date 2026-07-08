
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getCurrentSuperAdmin } from '@/lib/super-admin-auth';
import { SuperAdminNav } from '@/components/super-admin-nav';
import { SuperAdminHeader } from '@/components/super-admin-header';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import SuperAdminDashboardShell from './shell';

export default async function SuperAdminDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const superAdmin = await getCurrentSuperAdmin();

  if (!superAdmin) {
    redirect('/super-admin/login');
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="fixed inset-y-0 left-0 z-20 h-full">
          <SidebarContent className="flex flex-col h-full overflow-y-auto">
            <SidebarHeader className="p-4 flex h-16 items-center justify-center border-b border-sidebar-border md:pt-4 pt-8">
              <Link href="/super-admin/dashboard" className="flex items-center gap-2 font-semibold">
                <Image
                  src="/images/nibtickets.jpg"
                  alt="Nibkera Tickets Logo"
                  width={150}
                  height={40}
                  className="object-contain"
                  data-ai-hint="logo nibtera"
                />
              </Link>
              <div className="md:hidden ml-auto">
                <SidebarTrigger className="text-sidebar-foreground hover:text-sidebar-foreground" />
              </div>
            </SidebarHeader>
            <div className="flex-1">
              <SuperAdminNav />
            </div>
          </SidebarContent>
        </Sidebar>

        <SuperAdminDashboardShell>{children}</SuperAdminDashboardShell>
      </div>
    </SidebarProvider>
  );
}
