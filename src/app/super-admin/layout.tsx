import { cookies } from 'next/headers';
import { SuperAdminAuthProvider } from '@/context/super-admin-auth-context';

export default async function SuperAdminRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Without a session cookie there is no super-admin session to look up.
  const hasSession = !!(await cookies()).get('super_admin_token')?.value;
  return <SuperAdminAuthProvider hasSession={hasSession}>{children}</SuperAdminAuthProvider>;
}
