
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { encryptSessionPayload, decryptSessionPayload } from '@/lib/sessionCrypto';

// Use shared crypto utilities

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }
  try {
    const tokens = await req.json();
    const { accessToken, refreshToken } = tokens;

    if (!accessToken || !refreshToken) {
      return NextResponse.json({ success: false, error: 'Missing tokens' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const encrypted = await encryptSessionPayload(JSON.stringify(tokens));
    cookieStore.set('auth', encrypted, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  if (req.method !== 'GET') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get('auth');

  if (!tokenCookie) {
    return NextResponse.json({ accessToken: null }, { status: 401 });
  }

  try {
    const decrypted = await decryptSessionPayload(tokenCookie.value);
    const { accessToken } = JSON.parse(decrypted);
    return NextResponse.json({ accessToken });
  } catch (error) {
    return NextResponse.json({ accessToken: null }, { status: 401 });
  }
}

export async function DELETE(req: NextRequest) {
  if (req.method !== 'DELETE') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }
  const cookieStore = await cookies();
  cookieStore.delete('auth');
  return NextResponse.json({ success: true });
}
