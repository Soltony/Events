
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import type { User, Role } from '@prisma/client';

interface UserWithRole extends User {
  role: Role;
}

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  try {
    const headerList = headers();
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

    // Decode JWT to get user identifier (e.g., user ID or phone number)
    // This is a simplified decoding, in a real app, you would verify the signature
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) {
      return NextResponse.json({ isSuccess: false, error: 'Invalid token format.'}, { status: 401 });
    }

    const decodedJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
    const decoded = JSON.parse(decodedJson);
    const userId = decoded.sub; // Assuming 'sub' claim holds the user ID

    if (!userId) {
        return NextResponse.json({ isSuccess: false, error: 'Token does not contain a user identifier.'}, { status: 401 });
    }
    
    // Fetch user from your database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      return NextResponse.json({ isSuccess: false, error: 'User not found.'}, { status: 404 });
    }

    // In this flow, the token from the header is the source of truth.
    // We create a session cookie with it.
    const tokens = {
      accessToken: token,
      // A refresh token would typically come from your auth provider, 
      // but we'll use the access token here for simplicity in this flow.
      refreshToken: token, 
    };

    cookies().set('authTokens', JSON.stringify(tokens), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });

    return NextResponse.json({ isSuccess: true, user: user });

  } catch (error: any) {
    console.error('Auth init error:', error);
    return NextResponse.json({ isSuccess: false, error: error.message || 'An unexpected error occurred.' }, { status: 500 });
  }
}
