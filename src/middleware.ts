
import { NextRequest, NextResponse } from 'next/server';

// This file is being simplified as middleware should not handle heavy logic
// or use Node.js-specific APIs to remain Edge-compatible.
// Authentication and permission checks are now primarily handled in the AuthContext
// and via API routes running in the Node.js runtime.

// No-op middleware, as AuthGuard and API routes handle protection.
export function middleware(req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  // Match all paths to allow headers to be set, but the function is a no-op.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
