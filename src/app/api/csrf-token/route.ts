import { NextResponse, NextRequest } from 'next/server';
import { shouldUseSecureCookies } from '@/lib/cookie';
import { withApiErrorHandling } from '@/lib/api-handler';
import { CSRF_BOOTSTRAP_HEADER, CSRF_COOKIE, generateCsrfToken } from '@/lib/csrf-token';

// Returns this browser's CSRF token (see src/middleware.ts and src/lib/csrf-client.ts).
// The value is stored only in the HttpOnly `csrf_secret` cookie; this JSON body can be
// read by this origin's scripts but not by a cross-site page.
export const GET = withApiErrorHandling(async function GET(req: NextRequest) {
  // The middleware has already issued the cookie (if missing) and forwarded its value.
  const forwarded = req.headers.get(CSRF_BOOTSTRAP_HEADER);
  const existing = req.cookies.get(CSRF_COOKIE)?.value;
  const token = forwarded || existing || generateCsrfToken();

  const response = NextResponse.json({ csrfToken: token }, { headers: { 'Cache-Control': 'no-store' } });
  if (!forwarded && token !== existing) {
    response.cookies.set(CSRF_COOKIE, token, {
      httpOnly: true,
      secure: shouldUseSecureCookies(),
      sameSite: 'strict',
      path: '/',
    });
  }
  return response;
});
