
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

const CSRF_COOKIE_NAME_SECRET = 'csrf_secret';
const CSRF_COOKIE_NAME_TOKEN = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

function generateCsrfToken() {
  return nanoid(32);
}

function setCsrfCookies(res: NextResponse) {
  const token = generateCsrfToken();

  res.cookies.set(CSRF_COOKIE_NAME_SECRET, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });

  res.cookies.set(CSRF_COOKIE_NAME_TOKEN, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
}

export async function middleware(req: NextRequest) {
  // ✅ Allow NIB webhook to pass through
  if (req.nextUrl.pathname.startsWith('/api/payment/nib/notify')) {
    console.log('✅ Skipping middleware for NIB webhook');
    return NextResponse.next();
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const arifPayUrl = process.env.BASE_URL ? new URL(process.env.BASE_URL).origin : '';
  const nibPreProdUrl = process.env.AUTH_VALIDATION_URL || '';

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

  const isApiRequest = req.nextUrl.pathname.startsWith('/api/');
  const isStateChangingMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
  const isAuthRequest = req.nextUrl.pathname.startsWith('/api/auth/');

  if (isApiRequest && !isAuthRequest && isStateChangingMethod) {
    const csrfTokenFromHeader = req.headers.get(CSRF_HEADER_NAME);
    const csrfSecretFromCookie = req.cookies.get(CSRF_COOKIE_NAME_SECRET)?.value;

    if (!csrfTokenFromHeader || !csrfSecretFromCookie || csrfTokenFromHeader !== csrfSecretFromCookie) {
      console.warn(`CSRF validation failed for ${req.method} ${req.nextUrl.pathname}`);
      return new NextResponse('CSRF token mismatch', { status: 403 });
    }
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  if (!req.cookies.has(CSRF_COOKIE_NAME_SECRET) || !req.cookies.has(CSRF_COOKIE_NAME_TOKEN)) {
    setCsrfCookies(res);
  }

  res.headers.set('Content-Security-Policy', cspHeader.replace(/\s{2,}/g, ' ').trim());
  res.headers.set('X-Content-Type-Options', 'nosniff');

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
