
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
            <header className="sticky top-0 z-10 flex h-16 items-center justify-end px-4 md:px-6 border-b">
                <UserNav />
            </header>
            <main className="flex flex-1">
                {children}
            </main>
        </div>
    </AuthGuard>
  );
}
