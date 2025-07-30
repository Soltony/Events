
'use client';

import AuthGuard from '@/components/auth-guard';

export default function ProfileLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGuard>
        <div className="flex flex-col min-h-screen bg-background">
            <main className="flex-1 flex items-center justify-center p-4">
                {children}
            </main>
        </div>
    </AuthGuard>
  );
}
