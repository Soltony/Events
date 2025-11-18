
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

    const decodedToken = jwt.verify(token, JWT_SECRET) as { phoneNumber: string, iat: number, exp: number };
    
    if (!decodedToken.phoneNumber) {
        return NextResponse.json({ message: 'Invalid connection token.' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { phoneNumber: decodedToken.phoneNumber },
      include: { role: true },
    });

    // If the user exists, log them in by setting the auth_token and redirecting to the dashboard.
    if (user) {
        const sessionTokenPayload = {
            userId: user.id,
            role: user.role.name,
            permissions: user.role.permissions,
        };

        const sessionToken = jwt.sign(sessionTokenPayload, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN,
        });

        const cookie = serialize('auth_token', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24, // 1 day
        });

        const redirectUrl = new URL('/dashboard', req.url);
        const response = NextResponse.redirect(redirectUrl);
        response.headers.set('Set-Cookie', cookie);

        return response;
    } else {
        // If user does NOT exist, treat them as a guest.
        // Set a client-readable cookie with their phone number and redirect to the homepage.
        const guestPhoneCookie = serialize('phone_number', decodedToken.phoneNumber, {
            httpOnly: false, // Make it readable by client-side JS
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // Set for 1 week
        });

        const redirectUrl = new URL('/', req.url);
        const response = NextResponse.redirect(redirectUrl);
        response.headers.set('Set-Cookie', guestPhoneCookie);
        
        return response;
    }

  } catch (error) {
    console.error('[PORTAL_CONNECT_ERROR]', error);
    if (error instanceof jwt.JsonWebTokenError) {
        return NextResponse.json({ message: 'Invalid or expired connection token.' }, { status: 401 });
    }
    // For any other error, redirect to home as a guest to prevent showing the error page.
    const redirectUrl = new URL('/', req.url);
    return NextResponse.redirect(redirectUrl);
  }
}
