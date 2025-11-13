
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { encryptSessionPayload, decryptSessionPayload } from '@/lib/sessionCrypto';

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }
  try {
    const payload = await req.json();
    const { accessToken, phoneNumber } = payload;

    if (!accessToken || !phoneNumber) {
      return NextResponse.json({ success: false, error: 'Missing token or phone number' }, { status: 400 });
    }

    const encryptedData = await encryptSessionPayload(JSON.stringify(payload));
    
    const cookieStore = await cookies();
    cookieStore.set('auth', encryptedData, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Session creation error:", error);
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  if (req.method !== 'GET') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }
  
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get('auth');
    if (!cookie?.value) {
      return NextResponse.json({ accessToken: null, phoneNumber: null }, { status: 401 });
    }

    const decrypted = await decryptSessionPayload(cookie.value);
    const authData = JSON.parse(decrypted);

    const { accessToken, phoneNumber } = authData;
    return NextResponse.json({ accessToken, phoneNumber });
  } catch (error) {
    console.error('Error retrieving session data:', error);
    return NextResponse.json({ accessToken: null, phoneNumber: null }, { status: 401 });
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
