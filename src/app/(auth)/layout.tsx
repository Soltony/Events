
'use client';

import { MainNav } from '@/components/main-nav';
import { UserNav } from '@/components/user-nav';
import Link from 'next/link';
import Image from 'next/image';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import AuthGuard from '@/components/auth-guard';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGuard>
      <SidebarProvider>
        <div className="flex min-h-screen w-full flex-col">
          <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-sidebar text-sidebar-primary-foreground px-4 md:px-6 z-30">
            <div className="flex items-center gap-4">
               <div className="md:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                    >
                      <Menu className="h-5 w-5" />
                      <span className="sr-only">Toggle navigation menu</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0">
                     <div className="flex h-[60px] items-center border-b px-6 mb-4">
                          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                                <Image
                                  src="/image/nibtickets.jpg"
                                  alt="Nibkera Tickets Logo"
                                  width={150}
                                  height={40}
                                  className="object-contain"
                                  data-ai-hint="logo nibtera"
                                  />
                          </Link>
                      </div>
                    <nav className="grid gap-2 text-lg font-medium">
                      <MainNav />
                    </nav>
                  </SheetContent>
                </Sheet>
              </div>
              <Link href="/dashboard" className="hidden items-center gap-2 font-semibold md:flex">
                 <Image
                    src="/image/nibtickets.jpg"
                    alt="Nibkera Tickets Logo"
                    width={150}
                    height={40}
                    className="object-contain"
                    data-ai-hint="logo nibtera"
                  />
              </Link>
            </div>
            <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4 justify-end">
               <UserNav />
            </div>
          </header>
          <div className="flex flex-1">
            <Sidebar>
              <SidebarContent>
                 <div className="flex flex-col h-full">
                  <SidebarHeader className="flex items-center justify-between p-2">
                    <div className="p-2 font-semibold text-lg group-data-[collapsible=icon]:hidden">
                      Navigation
                    </div>
                    <SidebarTrigger />
                  </SidebarHeader>
                  <div className="flex-1 overflow-auto">
                    <MainNav />
                  </div>
                 </div>
              </SidebarContent>
            </Sidebar>
             <SidebarInset>
              <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background">
                {children}
              </main>
            </SidebarInset>
          </div>
        </div>
      </SidebarProvider>
    </AuthGuard>
  );
}
