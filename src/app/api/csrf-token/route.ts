import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

export async function GET() {
  const token = nanoid(32);
  
  const response = NextResponse.json({ csrfToken: token });
  
  // Set the CSRF token in a cookie that the client can read
  response.cookies.set('csrf_token', token, {
    httpOnly: false, // Must be readable by client-side script
    secure: true,
    sameSite: 'strict',
    path: '/',
  });
  
  return response;
}
