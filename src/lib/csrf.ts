import crypto from 'crypto';
import type { NextRequest } from 'next/server';

/**
 * Double-submit CSRF validation for state-changing requests.
 *
 * `/api/csrf-token` (and the auth bootstrap) issue a matched pair:
 *   - `csrf_secret`  — HttpOnly cookie, not readable by JS
 *   - `csrf_token`   — readable cookie, echoed back by the client in the
 *                      `X-CSRF-Token` header (see src/lib/api.ts interceptor)
 *
 * A forged cross-site POST can send the victim's cookies but cannot read the
 * readable cookie to populate the header, so header === secret proves same-origin.
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
