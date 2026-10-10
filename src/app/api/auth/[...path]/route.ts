import { NextResponse } from 'next/server';

// Catch-all for unknown /api/auth/* paths. The real endpoints (login, logout, refresh,
// change-password, …) are explicit routes and take precedence. Every method must return
// a response — a handler that returns nothing makes Next.js throw and answer 500.
function notFound() {
  return NextResponse.json({ message: 'Not found.' }, { status: 404 });
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
