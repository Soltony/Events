
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

// Function to verify CSRF token
function verifyCsrfToken(req: NextRequest): boolean {
  const csrfTokenFromHeader = req.headers.get('x-csrf-token');
  const csrfSecretFromCookie = req.cookies.get('csrf_secret')?.value;

  if (!csrfTokenFromHeader || !csrfSecretFromCookie) {
    console.warn('[CSRF Verification] Missing CSRF token in header or secret in cookie.');
    return false;
  }

  return csrfTokenFromHeader === csrfSecretFromCookie;
}

export function middleware(req: NextRequest) {
  // --- Nonce for Content Security Policy (CSP) ---
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`, // Allow inline styles for now for ShadCN
    `img-src 'self' blob: data: https://placehold.co https://storage.googleapis.com https://picsum.photos`,
    `font-src 'self'`,
    `connect-src 'self' blob: data: https://nominatim.openstreetmap.org`,
    `media-src 'self' blob: data:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ].join('; ');

  // Clone headers to be able to modify them
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  // --- CSRF Protection for state-changing methods ---
  const isStateChangingMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method.toUpperCase());

  if (isStateChangingMethod) {
    if (!verifyCsrfToken(req)) {
      console.error(`[CSRF Verification Failed] for path: ${req.nextUrl.pathname}`);
      return new NextResponse('Invalid CSRF token.', { status: 403 });
    }
  }
  
  // Create a new response with the modified headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Set other security headers on the response
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  response.headers.set('Permissions-Policy', "camera=(), microphone=(), geolocation=(), payment=()");
  response.headers.set('Content-Security-Policy', cspHeader);


  return response;
}

export const config = {
  // Match all paths to set headers, but CSRF is only checked for specific methods.
  matcher: ['/((?!_next/static|_next/image|images|favicon.ico).*)'],
};
