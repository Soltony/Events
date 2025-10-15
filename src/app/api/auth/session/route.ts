import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Define cookie options once to ensure consistency
const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as 'lax' | 'strict', // change to 'strict' if you prefer
  path: '/',
  maxAge: 60 * 60 * 24, // 1 day
};

export async function POST(req: NextRequest) {
  try {
    if (req.method !== 'POST') {
      return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
    }

    const { accessToken, refreshToken } = await req.json();

    if (!accessToken || !refreshToken) {
      return NextResponse.json({ success: false, error: 'Missing tokens' }, { status: 400 });
    }

    cookies().set('authTokens', JSON.stringify({ accessToken, refreshToken }), cookieOptions);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  try {
    if (req.method !== 'GET') {
      return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
    }

    const tokenCookie = cookies().get('authTokens');
    if (!tokenCookie) {
      return NextResponse.json({ accessToken: null }, { status: 401 });
    }

    const { accessToken } = JSON.parse(tokenCookie.value);
    return NextResponse.json({ accessToken });
  } catch {
    return NextResponse.json({ accessToken: null }, { status: 401 });
  }
}

export async function DELETE(req: NextRequest) {
  if (req.method !== 'DELETE') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  // Delete cookie with same attributes to ensure it clears correctly
  cookies().set('authTokens', '', {
    ...cookieOptions,
    maxAge: 0, // expire immediately
  });

  return NextResponse.json({ success: true });
}
