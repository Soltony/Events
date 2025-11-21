
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { serialize } from 'cookie';

export async function POST(req: NextRequest) {
  try {
    // Expire the internal auth token
    const authTokenCookie = serialize('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: -1,
    });
    
    // Expire the SuperApp token
    const superAppTokenCookie = serialize('superapp_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: -1,
    });

    const response = NextResponse.json({ message: 'Logout successful.' }, { status: 200 });
    // Set both cookies to expire
    response.headers.append('Set-Cookie', authTokenCookie);
    response.headers.append('Set-Cookie', superAppTokenCookie);

    return response;
  } catch (error) {
    console.error('[LOGOUT_ERROR]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
