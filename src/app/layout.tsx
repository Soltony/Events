
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/context/auth-context';
import { AuthStatus } from '@/components/auth-status';

export const metadata: Metadata = {
  title: 'EventFlow Tickets',
  description: 'The ultimate solution for event ticketing.',
  icons: null,
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
      <body className="font-body antialiased" suppressHydrationWarning={true}>
        <AuthProvider>
          <div className="flex flex-col min-h-screen relative">
              <div className="absolute top-4 right-4 z-10">
                <AuthStatus />
              </div>
              <main className="flex-1 bg-secondary">
                <div className="container mx-auto p-4 lg:p-6">
                  {children}
                </div>
              </main>
          </div>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
