
'use client';

import AuthGuard from '@/components/auth-guard';
import { UserNav } from '@/components/user-nav';

export default function ProfileLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGuard>
        <div className="flex flex-col min-h-screen bg-background">
             <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 flex-shrink-0">
              <div className="flex-1">
              </div>
              <UserNav />
            </header>
            <main className="flex-1 flex justify-center p-4 pt-8">
                {children}
            </main>
        </div>
    </AuthGuard>
  );
}
