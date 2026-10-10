import crypto from 'crypto';
import type { NextRequest } from 'next/server';

/**
 * CSRF validation for state-changing requests.
 *
 * src/middleware.ts already enforces this for every POST/PUT/PATCH/DELETE under /api and
 * every Server Action; route handlers call it again as defense in depth.
 *
 * The secret is kept in the HttpOnly `csrf_secret` cookie. The page receives the same value
 * via <meta name="csrf-token"> or GET /api/csrf-token and echoes it in `X-CSRF-Token`
 * (src/lib/csrf-client.ts). A forged cross-site request carries the cookie but cannot read
 * the value to populate the header, so header === secret proves same-origin.
 */
export function verifyCsrf(req: NextRequest): boolean {
  const headerToken =
    req.headers.get('x-csrf-token') ||
    req.headers.get('x-xsrf-token') ||
    '';

  const secret = req.cookies.get('csrf_secret')?.value || '';

  if (!headerToken || !secret) {
    return false;
  }

  const a = Buffer.from(headerToken, 'utf8');
  const b = Buffer.from(secret, 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Kept as a named export for route handlers that read better this way. */
export const assertSameOriginCsrf = verifyCsrf;
