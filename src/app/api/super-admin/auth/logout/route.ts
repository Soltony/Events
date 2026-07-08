
import { NextRequest, NextResponse } from 'next/server';
import { shouldUseSecureCookies } from '@/lib/cookie';

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ message: 'Logout successful.' }, { status: 200 });

  response.cookies.set('super_admin_token', '', {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: 'strict',
    path: '/',
    maxAge: -1,
  });

  return response;
}
