
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getCurrentUserFromCookie, hasPermission } from '@/lib/auth-middleware';

const CSRF_COOKIE_NAME_SECRET = 'csrf_secret';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

const PROTECTED_ROUTES: Record<string, string | string[]> = {
  '/dashboard': 'Dashboard:Read',
  '/dashboard/scan': 'Scan QR:Read',
  '/dashboard/events': 'Events:Read',
  '/dashboard/reports': 'Reports:Read',
  '/dashboard/settings': ['User Management:Read', 'Role Management:Read', 'Staff Management:Read'],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- Authentication & Authorization Checks ---
  if (pathname.startsWith('/dashboard')) {
      const user = await getCurrentUserFromCookie();

      if (!user) {
          const url = req.nextUrl.clone();
          url.pathname = '/login';
          return NextResponse.redirect(url);
      }

      if (user.passwordChangeRequired && pathname !== '/profile') {
          const url = req.nextUrl.clone();
          url.pathname = '/profile';
          return NextResponse.redirect(url);
      }

      const requiredPermission = Object.keys(PROTECTED_ROUTES).find(
        (route) => pathname.startsWith(route) && route.length > 1 // Exclude '/'
      );

      if (requiredPermission) {
        const permission = PROTECTED_ROUTES[requiredPermission];
        const permissionsToCheck = Array.isArray(permission) ? permission : [permission];
        
        const userHasPermission = permissionsToCheck.some(p => hasPermission(user, p));

        if (!userHasPermission) {
           const url = req.nextUrl.clone();
           url.pathname = '/dashboard'; // Redirect to a safe default page
           return NextResponse.redirect(url);
        }
      }
  }


  // --- CSRF Protection ---
  if (pathname.startsWith('/api/')) {
    const isStateChangingMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
    const publicApiRoutes = ['/api/auth/login', '/api/auth/register', '/api/payment/nib/notify'];
    
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
