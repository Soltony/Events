
import { NextRequest, NextResponse } from 'next/server';
import { setSecureCookie, getSecureCookie, deleteSecureCookie } from '@/lib/cookieUtils';

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }
  try {
    const payload = await req.json();
    const { accessToken, refreshToken, phoneNumber } = payload;

    if (!accessToken || !phoneNumber) {
      return NextResponse.json({ success: false, error: 'Missing token or phone number' }, { status: 400 });
    }

    // Use our new utility function to set the secure cookie
    await setSecureCookie('auth', payload, {
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
  
  try {
    const authData = await getSecureCookie('auth');
    
    if (!authData) {
      return NextResponse.json({ accessToken: null, phoneNumber: null }, { status: 401 });
    }
    
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
  
  await deleteSecureCookie('auth');
  return NextResponse.json({ success: true });
}
