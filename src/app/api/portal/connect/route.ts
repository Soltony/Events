
'use server';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '1d'; // 1 day

export async function GET(req: NextRequest) {
  try {
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is not set.');
    }

    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ message: 'Connection token is missing.' }, { status: 400 });
    }

    // In a real scenario, this token would be a one-time use token
    // that is validated against a database or another service.
    // For this prototype, we'll assume the token directly contains the user's phone number.
    const decodedToken = jwt.verify(token, JWT_SECRET) as { phoneNumber: string, iat: number, exp: number };
    
    if (!decodedToken.phoneNumber) {
        return NextResponse.json({ message: 'Invalid connection token.' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { phoneNumber: decodedToken.phoneNumber },
      include: { role: true },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found.' }, { status: 404 });
    }

    // User found, create a standard session token (JWT)
    const sessionTokenPayload = {
      userId: user.id,
      role: user.role.name,
      permissions: user.role.permissions,
    };

    const sessionToken = jwt.sign(sessionTokenPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    // Set the session token in an HttpOnly cookie
    const cookie = serialize('auth_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });

    // Redirect to the dashboard after successful connection
    const redirectUrl = new URL('/dashboard', req.url);
    const response = NextResponse.redirect(redirectUrl);
    response.headers.set('Set-Cookie', cookie);

    return response;

  } catch (error) {
    console.error('[PORTAL_CONNECT_ERROR]', error);
    if (error instanceof jwt.JsonWebTokenError) {
        return NextResponse.json({ message: 'Invalid or expired connection token.' }, { status: 401 });
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
