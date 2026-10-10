
import type { Metadata } from 'next';
import Image from 'next/image';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, type SessionState } from '@/context/auth-context';
import { ConditionalFooter } from '@/components/conditional-footer';
import { cookies, headers } from 'next/headers'
import React from 'react';
import { CspNonceProvider } from '@/components/csp-nonce';
import { CsrfTokenProvider } from '@/components/csrf-token-provider';
import { CSRF_BOOTSTRAP_HEADER } from '@/lib/csrf-token';

/**
 * What AuthProvider should do on load: nothing (no session cookie), look the user up, or
 * refresh first because the 15-minute access token inside the cookie has expired. The
 * payload is only read here, not trusted: every API verifies the token itself.
 */
function sessionState(authToken: string | undefined): SessionState {
  if (!authToken) return 'none';
  try {
    const payload = JSON.parse(Buffer.from(authToken.split('.')[1] ?? '', 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now() + 5000 ? 'expired' : 'active';
  } catch {
    return 'active';
  }
}

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NibTera Tickets',
  description: 'The ultimate solution for event ticketing.',
  icons: {
    icon: '/images/favicon.ico',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') ?? ""
  // Set by src/middleware.ts; handed to src/lib/csrf-client.ts. The secret itself stays in an HttpOnly cookie.
  const csrfToken = headersList.get(CSRF_BOOTSTRAP_HEADER) ?? ""
  const cookieStore = await cookies();
  const session = sessionState(cookieStore.get('auth_token')?.value);
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="font-body antialiased" suppressHydrationWarning={true}>
        <CspNonceProvider nonce={nonce}>
        <CsrfTokenProvider token={csrfToken}>
        <AuthProvider session={session}>
            <div className="flex flex-col min-h-screen relative">
              <main className="flex-1 bg-background">
                {children}
              </main>
              <ConditionalFooter />
            </div>
            <Toaster />
        </AuthProvider>
        </CsrfTokenProvider>
        </CspNonceProvider>
      </body>
    </html>
  );
}
