
'use client';

import { SuperAdminAuthProvider } from '@/context/super-admin-auth-context';

export default function SuperAdminRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <SuperAdminAuthProvider>{children}</SuperAdminAuthProvider>;
}
