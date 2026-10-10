/**
 * CSRF token primitives shared by the edge middleware and Node route handlers
 * (Web Crypto only — no Node `crypto` import, so this is safe in the edge runtime).
 */

/** HttpOnly, SameSite=Strict cookie holding this browser's CSRF secret. */
export const CSRF_COOKIE = 'csrf_secret';

/** Readable mirror cookie used before the secret moved to <meta>/JSON; now expired on sight. */
export const LEGACY_CSRF_COOKIE = 'csrf_token';

/** Header the client must echo the token in on state-changing requests. */
export const CSRF_REQUEST_HEADER = 'x-csrf-token';

/**
 * Internal request header the middleware sets (always overwriting any client value) so the
 * root layout and /api/csrf-token can read the token issued for this request.
 */
export const CSRF_BOOTSTRAP_HEADER = 'x-csrf-bootstrap';

export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Constant-time string comparison (length is not secret: tokens are fixed-length). */
export function csrfTokensMatch(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
