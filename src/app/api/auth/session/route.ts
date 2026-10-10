import { NextResponse } from 'next/server';

// Retired endpoint: session management is handled by /api/auth/login, /api/auth/logout,
// /api/auth/refresh and HttpOnly JWT cookies. Kept so old clients get a clean 410 instead
// of an unhandled 500 (a handler that returns nothing makes Next.js throw).
function gone() {
  return NextResponse.json({ message: 'This endpoint is no longer available.' }, { status: 410 });
}

export const GET = gone;
export const POST = gone;
