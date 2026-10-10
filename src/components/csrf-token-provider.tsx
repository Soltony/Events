'use client';

import type { ReactNode } from 'react';
import { setCsrfToken } from '@/lib/csrf-client';

/**
 * Hands the CSRF token issued by the middleware for this request (read in the root layout)
 * to src/lib/csrf-client.ts. Kept in memory rather than in a <meta> tag: an extra <head>
 * element can race Next's streamed metadata during hydration.
 */
export function CsrfTokenProvider({ token, children }: { token: string; children: ReactNode }) {
  if (token && typeof window !== 'undefined') {
    setCsrfToken(token);
  }
  return <>{children}</>;
}
