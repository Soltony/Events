
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
    const { phoneNumber, accessToken } = body;
    
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
    
    // The token has been validated by the caller (/portal/connect).
    // Now, create the session payload for our application.
    const sessionPayload = {
      accessToken: accessToken, // Store the original token if needed later
      refreshToken: '', // Can be managed separately if needed
      phoneNumber: phoneNumber,
    };

    const cookieStore = await cookies();
    const encrypted = await encryptSessionPayload(JSON.stringify(sessionPayload));

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
