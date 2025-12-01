
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);

  if (!user) {
    const response = NextResponse.json({ message: 'Authentication failed.' }, { status: 401 });
    // Ensure the cookie is cleared if authentication fails
    response.cookies.set('auth_token', '', { httpOnly: true, path: '/', maxAge: -1 });
    return response;
  }
  
  // Exclude password before sending user object to the client
  const { password, ...userWithoutPassword } = user;

  return NextResponse.json(
    { user: { ...userWithoutPassword, isGuest: user.role.name === 'Guest' } },
    { status: 200 }
  );
}
