
'use server';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { headers } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET;

export async function GET(req: NextRequest) {
  try {
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is not set.');
    }

    const token = req.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      isGuest?: boolean;
      phoneNumber?: string;
      ip?: string;
      userAgent?: string;
      tokenVersion?: number;
    };

    if (!decoded.userId) {
      return NextResponse.json({ message: 'Invalid token payload.' }, { status: 401 });
    }

    // -----------------------------
    // Guest User Handler
    // -----------------------------
    if (decoded.isGuest) {
      const guestUser = {
        id: decoded.userId,
        phoneNumber: decoded.phoneNumber ?? "",
        isGuest: true,
        role: { name: "Guest" }
      };

      return NextResponse.json({ user: guestUser }, { status: 200 });
    }
    
    // --- Session Binding Verification ---
    const headersList = headers();
    const currentIp = headersList.get('x-forwarded-for') ?? '127.0.0.1';
    const currentUserAgent = headersList.get('user-agent') ?? '';
    
    if (decoded.ip !== currentIp || decoded.userAgent !== currentUserAgent) {
        console.warn(`Session hijacking attempt detected for user ${decoded.userId}. Token IP: ${decoded.ip}, Request IP: ${currentIp}. Token UA: ${decoded.userAgent}, Request UA: ${currentUserAgent}`);
        // Invalidate cookie by sending an expired one
        const response = NextResponse.json({ message: 'Invalid session. Please log in again.' }, { status: 401 });
        response.cookies.set('auth_token', '', { httpOnly: true, path: '/', maxAge: -1 });
        return response;
    }


    // -----------------------------
    // Normal User
    // -----------------------------
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { role: true },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found.' }, { status: 404 });
    }

    // --- Token Version Verification ---
    if (user.tokenVersion !== decoded.tokenVersion) {
        console.warn(`Token revocation check failed for user ${user.id}. Token version: ${decoded.tokenVersion}, DB version: ${user.tokenVersion}`);
        const response = NextResponse.json({ message: 'Session has been invalidated. Please log in again.' }, { status: 401 });
        response.cookies.set('auth_token', '', { httpOnly: true, path: '/', maxAge: -1 });
        return response;
    }

    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json(
      { user: { ...userWithoutPassword, isGuest: false } },
      { status: 200 }
    );

  } catch (error) {
    console.error('[ME_ERROR]', error);

    if (error instanceof jwt.JsonWebTokenError) {
      const response = NextResponse.json({ message: 'Invalid token.' }, { status: 401 });
      response.cookies.set('auth_token', '', { httpOnly: true, path: '/', maxAge: -1 });
      return response;
    }

    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
