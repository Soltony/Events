
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'EventFlow Tickets',
  description: 'The ultimate solution for event ticketing.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <div className="flex flex-col min-h-screen">
            <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6">
                <Link href="/" className="flex items-center gap-2 font-semibold">
                  <Logo />
                  <span className="">EventFlow</span>
                </Link>
              <div className="w-full flex-1">
                {/* Future Search bar can go here */}
              </div>
              <Button asChild>
                  <Link href="/login">Organizer Login</Link>
              </Button>
            </header>
            <main className="flex-1 bg-muted/40">
              <div className="container mx-auto p-4 lg:p-6">
                {children}
              </div>
            </main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
