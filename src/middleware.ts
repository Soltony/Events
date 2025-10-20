
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
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
  
  const res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

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
    // Match all routes except for the ones starting with /api
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
