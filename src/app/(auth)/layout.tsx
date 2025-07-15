
import { MainNav } from '@/components/main-nav';
import { Logo } from '@/components/logo';
import { UserNav } from '@/components/user-nav';
import Link from 'next/link';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, PanelLeft } from 'lucide-react';
import AuthGuard from '@/components/auth-guard';
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarContent, SidebarHeader, SidebarFooter } from '@/components/ui/sidebar';

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGuard>
      <SidebarProvider>
        <div className="grid min-h-screen w-full bg-background">
          <Sidebar>
            <SidebarContent className="flex flex-col">
              <SidebarHeader>
                <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                  <Logo />
                  <span className="text-lg">EventFlow</span>
                </Link>
              </SidebarHeader>
              <div className="flex-1">
                <MainNav />
              </div>
              <SidebarFooter>
                <UserNav />
              </SidebarFooter>
            </SidebarContent>
          </Sidebar>
          <div className="flex flex-col md:peer-data-[state=expanded]:ml-[280px] peer-data-[state=collapsed]:ml-[0px] transition-[margin-left] duration-300 ease-in-out">
            <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-card px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-2">
              <SidebarTrigger className="sm:hidden" />
              <div className="w-full flex-1">
                {/* Future Search bar can go here */}
              </div>
              <div className="hidden sm:block">
                 <UserNav />
              </div>
            </header>
            <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 pt-0">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </AuthGuard>
  );
}
