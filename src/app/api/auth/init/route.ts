
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
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
    const headerList = await headers();
    const authHeader = headerList.get('Authorization');

    if (!authHeader) {
      return NextResponse.json({
        isSuccess: false,
        error: 'Authorization header is missing from the request.',
      }, { status: 401 });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        isSuccess: false,
        error: 'Authorization header is malformed. It must start with Bearer.',
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const validationUrl = process.env.AUTH_VALIDATION_URL;

    if (!validationUrl) {
      console.error('AUTH_VALIDATION_URL is not set in environment variables.');
      return NextResponse.json({ isSuccess: false, error: 'Authentication service is not configured.' }, { status: 500 });
    }
    
    // Validate the token with the external service
    const externalResponse = await fetch(validationUrl, {
        method: 'GET',
        headers: {
            Authorization: authHeader,
            Accept: 'application/json',
        },
        cache: 'no-store',
    });

    if (!externalResponse.ok) {
        const errorText = await externalResponse.text();
        console.error(`External token validation failed with status ${externalResponse.status}: ${errorText}`);
        return NextResponse.json({ isSuccess: false, error: 'Token validation failed.'}, { status: 401 });
    }

    const responseData = await externalResponse.json();
    const phoneNumber = responseData.phone;
    
    if (!phoneNumber) {
        return NextResponse.json({ isSuccess: false, error: 'External service did not return a phone number.'}, { status: 401 });
    }
    
    // Fetch user from your database using the phone number
    const user = await prisma.user.findUnique({
      where: { phoneNumber: phoneNumber },
      include: { role: true },
    });

    if (!user) {
      return NextResponse.json({ isSuccess: false, error: 'User not found in local database.'}, { status: 404 });
    }

    const tokens = {
      accessToken: token,
      refreshToken: token,
      phoneNumber: phoneNumber,
    };

    const cookieStore = await cookies();
    const encrypted = await encryptSessionPayload(JSON.stringify(tokens));
    cookieStore.set('auth', encrypted, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });

    return NextResponse.json({ isSuccess: true, user: user });

  } catch (error: any) {
    console.error('Auth init error:', error);
    return NextResponse.json({ isSuccess: false, error: error.message || 'An unexpected error occurred.' }, { status: 500 });
  }
}
