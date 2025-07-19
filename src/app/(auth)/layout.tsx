

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
      <div className="relative flex min-h-screen w-full">
        <div className="hidden md:block fixed top-0 left-0 h-full w-[220px] lg:w-[280px] border-r bg-sidebar">
          <div className="flex h-full max-h-screen flex-col gap-2">
            <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
              <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                <Image src="https://sdmntprwestus2.oaiusercontent.com/files/00000000-3fe4-61f8-ad48-fc57e9f36849/raw?se=2025-07-19T09%3A14%3A18Z&sp=r&sv=2024-08-04&sr=b&scid=50db1888-8a8c-5f2e-8d5d-d41402fb4415&skoid=add8ee7d-5fc7-451e-b06e-a82b2276cf62&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-07-19T02%3A21%3A06Z&ske=2025-07-20T02%3A21%3A06Z&sks=b&skv=2024-08-04&sig=MyAXfeV%2BQY0NDXL4I2f/IKkhwhOo2UiOacqRxRhoYIU%3D" alt="Nibkera Tickets Logo" width={150} height={40} className="object-contain" data-ai-hint="logo nibtera" />
              </Link>
            </div>
            <div className="flex-1 overflow-y-auto">
              <MainNav />
            </div>
          </div>
        </div>
        <div className="flex flex-col flex-1 md:ml-[220px] lg:ml-[280px]">
          <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6 sticky top-0 z-30">
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
              <SheetContent side="left" className="flex flex-col p-0 w-[280px]">
                 <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 text-lg font-semibold"
                  >
                     <Image src="https://sdmntprwestus2.oaiusercontent.com/files/00000000-3fe4-61f8-ad48-fc57e9f36849/raw?se=2025-07-19T09%3A14%3A18Z&sp=r&sv=2024-08-04&sr=b&scid=50db1888-8a8c-5f2e-8d5d-d41402fb4415&skoid=add8ee7d-5fc7-451e-b06e-a82b2276cf62&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-07-19T02%3A21%3A06Z&ske=2025-07-20T02%3A21%3A06Z&sks=b&skv=2024-08-04&sig=MyAXfeV%2BQY0NDXL4I2f/IKkhwhOo2UiOacqRxRhoYIU%3D" alt="Nibkera Tickets Logo" width={150} height={40} className="object-contain" data-ai-hint="logo nibtera" />
                  </Link>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <MainNav />
                </div>
              </SheetContent>
            </Sheet>
            <div className="w-full flex-1">
              {/* Future Search bar can go here */}
            </div>
            <UserNav />
          </header>
          <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
