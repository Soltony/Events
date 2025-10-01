
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const tokens = await req.json();
    const { accessToken, refreshToken } = tokens;

    if (!accessToken || !refreshToken) {
      return NextResponse.json({ success: false, error: 'Missing tokens' }, { status: 400 });
    }

    cookies().set('authTokens', JSON.stringify(tokens), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const cookieStore = cookies();
  const tokenCookie = cookieStore.get('authTokens');

  if (!tokenCookie) {
    return NextResponse.json({ accessToken: null }, { status: 401 });
  }

  try {
    const { accessToken } = JSON.parse(tokenCookie.value);
    return NextResponse.json({ accessToken });
  } catch (error) {
    return NextResponse.json({ accessToken: null }, { status: 401 });
  }
}

export async function DELETE(req: NextRequest) {
  cookies().delete('authTokens');
  return NextResponse.json({ success: true });
}
