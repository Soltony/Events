
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { serialize } from 'cookie';

export async function POST(req: NextRequest) {
  try {
    // Expire the cookie by setting its maxAge to a past date
    const cookie = serialize('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: -1,
    });

    const response = NextResponse.json({ message: 'Logout successful.' }, { status: 200 });
    response.headers.set('Set-Cookie', cookie);

    return response;
  } catch (error) {
    console.error('[LOGOUT_ERROR]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
