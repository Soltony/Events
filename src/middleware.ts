
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

const CSRF_COOKIE_NAME_SECRET = 'csrf_secret';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

export async function middleware(req: NextRequest) {
  // Allow specific routes to pass through without CSRF checks
  const publicApiRoutes = [
    '/api/payment/nib/notify',
    '/api/auth/session',
    '/api/csrf-token'
  ];

  if (publicApiRoutes.includes(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const isApiRequest = req.nextUrl.pathname.startsWith('/api/');
  const isStateChangingMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);

  if (isApiRequest && isStateChangingMethod) {
    const csrfTokenFromHeader = req.headers.get(CSRF_HEADER_NAME);
    const csrfSecretFromCookie = req.cookies.get(CSRF_COOKIE_NAME_SECRET)?.value;

    if (!csrfTokenFromHeader || !csrfSecretFromCookie || csrfTokenFromHeader !== csrfSecretFromCookie) {
        console.warn(`CSRF validation failed for ${req.method} ${req.nextUrl.pathname}`);
        return new NextResponse(JSON.stringify({ error: 'CSRF token mismatch or missing' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
  }
  
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const arifPayUrl = process.env.BASE_URL ? new URL(process.env.BASE_URL).origin : '';
  const nibPreProdUrl = process.env.AUTH_VALIDATION_URL || '';

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: https://placehold.co https://storage.googleapis.com https://picsum.photos;
    connect-src 'self' https://nominatim.openstreetmap.org ${arifPayUrl} ${nibPreProdUrl};
    frame-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
  `.replace(/\s{2,}/g, ' ').trim();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  
  // Set security headers on the response
  res.headers.set('Content-Security-Policy', cspHeader);
  res.headers.set('X-Content-Type-Options', 'nosniff');

  // Make sure the theme cookie is HttpOnly
  const themeCookie = req.cookies.get('nib-theme');
  if (themeCookie) {
    res.cookies.set('nib-theme', themeCookie.value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }
  
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
