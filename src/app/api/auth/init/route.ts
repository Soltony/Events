
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import type { User, Role } from '@prisma/client';
import { encryptSessionPayload } from '@/lib/sessionCrypto';

interface UserWithRole extends User {
  role: Role;
}

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  try {
    const body = await req.json();
    const phoneNumber = body.phoneNumber;
    
    if (!phoneNumber) {
        return NextResponse.json({ isSuccess: false, error: 'Phone number is required.'}, { status: 400 });
    }
    
    // Fetch user from your database using the phone number
    const user = await prisma.user.findUnique({
      where: { phoneNumber: phoneNumber },
      include: { role: true },
    });

    if (!user) {
      return NextResponse.json({ isSuccess: false, error: 'User not found in local database.'}, { status: 404 });
    }
    
    // We assume the token is already validated by the caller.
    // Here, we just need a placeholder or a self-signed token for the cookie if needed.
    // For simplicity, we'll create a simple payload.
    const tokens = {
      // In a real scenario, you might generate a new session token here.
      // For this flow, we might not even need to store an external token.
      accessToken: 'internal-session',
      refreshToken: 'internal-session',
      phoneNumber: phoneNumber,
    };

    const cookieStore = await cookies();
    const encrypted = await encryptSessionPayload(JSON.stringify(tokens));

    // Set the secure, HttpOnly cookie to establish the session
    cookieStore.set('auth', encrypted, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });

    // Return the user data to confirm success
    return NextResponse.json({ isSuccess: true, user: user });

  } catch (error: any) {
    console.error('Auth init error:', error);
    return NextResponse.json({ isSuccess: false, error: error.message || 'An unexpected error occurred.' }, { status: 500 });
  }
}
