
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

// --- CSRF Protection Configuration ---
const CSRF_COOKIE_NAME_SECRET = 'csrf_secret';
const CSRF_COOKIE_NAME_TOKEN = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

/**
 * Creates a unique, cryptographically-secure token.
 */
function generateCsrfToken() {
  return nanoid(32);
}

/**
 * Sets the CSRF cookies on the response.
 * @param res The NextResponse object to modify.
 */
function setCsrfCookies(res: NextResponse) {
  const token = generateCsrfToken();
  
  // The secret is stored in an HttpOnly cookie for server-side validation.
  res.cookies.set(CSRF_COOKIE_NAME_SECRET, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
  });
  
  // The value is sent in a separate, readable cookie for the client to use.
  res.cookies.set(CSRF_COOKIE_NAME_TOKEN, token, {
    httpOnly: false, // Must be readable by client-side script
    secure: true,
    sameSite: 'strict',
    path: '/',
  });
}

export async function middleware(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  
  // ArifPay URL for connect-src, if available
  const arifPayUrl = process.env.BASE_URL ? new URL(process.env.BASE_URL).origin : '';
  const nibPreProdUrl = 'http://nib-pre-production.nibbank.com.et:8086';

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com https://unpkg.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: https://placehold.co https://storage.googleapis.com https://picsum.photos;
    connect-src 'self' https://nominatim.openstreetmap.org ${arifPayUrl} ${nibPreProdUrl};
    frame-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
  `;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);

  // --- Start CSRF Logic ---
  const isApiRequest = req.nextUrl.pathname.startsWith('/api/');
  const isStateChangingMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
  const isAuthRequest = req.nextUrl.pathname.startsWith('/api/auth/');

  // Check if it's a state-changing API request that needs CSRF protection.
  // We explicitly EXCLUDE auth requests from this check, as they handle session creation.
  if (isApiRequest && !isAuthRequest && isStateChangingMethod) {
    const csrfTokenFromHeader = req.headers.get(CSRF_HEADER_NAME);
    const csrfSecretFromCookie = req.cookies.get(CSRF_COOKIE_NAME_SECRET)?.value;

    // Validate that the token from the header matches the secret in the cookie.
    if (!csrfTokenFromHeader || !csrfSecretFromCookie || csrfTokenFromHeader !== csrfSecretFromCookie) {
      console.warn(`CSRF validation failed for ${req.method} ${req.nextUrl.pathname}`);
      return new NextResponse('CSRF token mismatch', { status: 403 });
    }
  }
  
  const res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Set new CSRF cookies on the response if they don't exist.
  if (!req.cookies.has(CSRF_COOKIE_NAME_SECRET) || !req.cookies.has(CSRF_COOKIE_NAME_TOKEN)) {
    setCsrfCookies(res);
  }

  // --- End CSRF Logic ---

  // Also set the CSP header on the response
  res.headers.set('Content-Security-Policy', cspHeader.replace(/\s{2,}/g, ' ').trim());
  res.headers.set('X-Content-Type-Options', 'nosniff');

  // Handle theme cookie
  const themeCookie = req.cookies.get('nib-theme');
  if (themeCookie) {
    res.cookies.set('nib-theme', themeCookie.value, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
  }

  return res;
}

export const config = {
  matcher: [
    // Match all routes except for the ones starting with /api that are GET requests (to avoid running on every poll)
    // and static files or image optimization.
    {
      source: '/((?!api/payment/status|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
