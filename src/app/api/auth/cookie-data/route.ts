'use server';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { encryptSessionPayload } from '@/lib/sessionCrypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, accessToken } = body;

    if (!phoneNumber || !accessToken) {
      return NextResponse.json(
        { success: false, message: 'Missing authentication data' },
        { status: 400 }
      );
    }

    // Encrypt the session data before storing
    const payload = JSON.stringify({ phoneNumber, accessToken });
    const encrypted = await encryptSessionPayload(payload);

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set({
      name: 'auth',
      value: encrypted,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return NextResponse.json({
      success: true,
      message: 'Authentication cookie set successfully'
    });
  } catch (error) {
    console.error('Error setting auth cookie:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to set auth cookie' },
      { status: 500 }
    );
  }
}
