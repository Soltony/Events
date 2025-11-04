
import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

// This endpoint generates a synchronized pair of CSRF tokens.
// One is a HttpOnly cookie (the secret), and the other is a client-readable cookie.
// The client sends the readable token in a header, and the middleware verifies it against the secret.
export async function GET() {
  const token = nanoid(32);
  const response = NextResponse.json({ message: 'CSRF token set' });

  // Set the secret token in an HttpOnly cookie
  response.cookies.set('csrf_secret', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // Use 'lax' for better cross-origin behavior
    path: '/',
  });
  
  // Set the readable token in a regular cookie
  response.cookies.set('csrf_token', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // Use 'lax' for better cross-origin behavior
    path: '/',
  });
  
  return response;
}
