
import { NextRequest, NextResponse } from 'next/server';

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

  // --- CSRF Protection & Headers ---
  // The CSRF logic has been moved to the server actions and API routes where it's needed,
  // and the CSP headers are now managed in next.config.js for better compatibility.
  // This middleware is now only responsible for authentication checks.
  
  return NextResponse.next();
}

export const config = {
  // This matcher excludes API routes, static files, and image optimization files.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|image).*)'],
};
