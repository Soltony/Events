
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
        <div className="flex min-h-screen w-full">
            <Sidebar>
                <SidebarContent>
                    <div className="flex flex-col h-full">
                        <SidebarHeader className="p-4 border-b border-sidebar-border">
                             <div className="flex items-center gap-2">
                                <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                                     <Image
                                    src="/image/nibtickets.jpg"
                                    alt="Nibkera Tickets Logo"
                                    width={40}
                                    height={40}
                                    className="object-contain rounded-md"
                                    data-ai-hint="logo nibtera"
                                    />
                                     <div className="flex flex-col">
                                        <span className="text-sm font-bold text-sidebar-foreground">NibTera</span>
                                        <span className="text-xs text-sidebar-foreground/80">Ticketing Solution</span>
                                    </div>
                                </Link>
                                <div className="ml-auto md:hidden">
                                     <SidebarTrigger />
                                </div>
                             </div>
                        </SidebarHeader>
                        <div className="flex-1 overflow-auto py-2">
                            <MainNav />
                        </div>
                    </div>
                </SidebarContent>
            </Sidebar>

            <div className="flex flex-col flex-1">
                 <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
                    <div className="md:hidden">
                        <SidebarTrigger />
                    </div>
                    <div className="flex-1">
                        {/* Page title would go here if needed */}
                    </div>
                    <UserNav />
                </header>
                 <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background">
                    {children}
                 </main>
            </div>
        </div>
      </SidebarProvider>
    </AuthGuard>
  );
}
