import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AuthShell from './auth-shell';

// Server-side gate for every page in the authenticated Admin Portal (/dashboard/*,
// /profile). The token's signature, token version and server-side session (revocation,
// idle and absolute timeouts) are all verified here, before anything is rendered — so a
// revoked, stale or forged token gets an HTTP redirect to /login rather than the page
// shell. The client-side AuthGuard inside AuthShell remains for in-app navigation.
export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return <AuthShell>{children}</AuthShell>;
}
