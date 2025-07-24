
'use client';

import { MainNav } from '@/components/main-nav';
import { UserNav } from '@/components/user-nav';
import Link from 'next/link';
import Image from 'next/image';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import AuthGuard from '@/components/auth-guard';

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGuard>
        <div className="flex min-h-screen w-full flex-col">
          <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-30">
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
            <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
                <div className="ml-auto flex-1 sm:flex-initial">
                   {/* Optional search can go here */}
                </div>
                 <UserNav />
                 <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 md:hidden"
                  >
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle navigation menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left">
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
          </header>
          <div className="flex flex-1">
             <aside className="hidden w-64 flex-col border-r bg-muted/40 md:flex">
                <div className="flex h-full max-h-screen flex-col gap-2">
                    <div className="flex-1 overflow-auto py-2">
                        <MainNav />
                    </div>
                </div>
            </aside>
            <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background">
              {children}
            </main>
          </div>
        </div>
    </AuthGuard>
  );
}
