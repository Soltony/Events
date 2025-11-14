
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

const CSRF_COOKIE_NAME_SECRET = 'csrf_secret';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

const PROTECTED_ROUTES = [
  '/dashboard',
  '/profile'
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const cookies = req.cookies;

  // --- Authentication & Authorization Checks ---
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  
  if (isProtectedRoute) {
      const token = cookies.get('auth_token');
      if (!token) {
          const url = req.nextUrl.clone();
          url.pathname = '/login';
          return NextResponse.redirect(url);
      }
  }


  // --- CSRF Protection ---
  if (pathname.startsWith('/api/')) {
    const isStateChangingMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
    const publicApiRoutes = ['/api/auth/login', '/api/auth/register', '/api/payment/nib/notify', '/api/auth/logout'];
    
    if (isStateChangingMethod && !publicApiRoutes.includes(pathname)) {
      const csrfTokenFromHeader = req.headers.get(CSRF_HEADER_NAME);
      const csrfSecretFromCookie = req.cookies.get(CSRF_COOKIE_NAME_SECRET)?.value;

      if (!csrfTokenFromHeader || !csrfSecretFromCookie || csrfTokenFromHeader !== csrfSecretFromCookie) {
          console.error(`CSRF validation failed for ${req.method} ${pathname}.`);
          return new NextResponse(JSON.stringify({ error: 'CSRF token mismatch or missing' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
    }
  }
  
  // --- Content Security Policy ---
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: https://placehold.co https://storage.googleapis.com https://picsum.photos;
    connect-src 'self' https://nominatim.openstreetmap.org;
    frame-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
  `.replace(/\s{2,}/g, ' ').trim();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  
  res.headers.set('Content-Security-Policy', cspHeader);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
