
'use server';

import { headers } from 'next/headers';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '1d';
const GUEST_JWT_EXPIRES_IN = '1h'; // Guest token is valid for 1 hour
const VALIDATE_TOKEN_URL = process.env.VALIDATE_TOKEN_URL;

export async function GET(req: NextRequest) {
  if (!VALIDATE_TOKEN_URL || !JWT_SECRET) {
    console.error('[PORTAL_CONNECT] Server is missing NIB_VALIDATE_TOKEN_URL or JWT_SECRET environment variables.');
    return NextResponse.redirect(new URL('/', req.url));
  }
  
  const headerList = headers();
  const authHeader = headerList.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[PORTAL_CONNECT] No valid SuperApp authorization header found. Proceeding as guest.');
    return NextResponse.redirect(new URL('/', req.url));
  }

  try {
    const token = authHeader.substring(7);
    const externalResponse = await fetch(VALIDATE_TOKEN_URL, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!externalResponse.ok) {
        let errorBody = 'Failed to validate SuperApp token.';
        try {
            const err = await externalResponse.json();
            errorBody = err.message || errorBody;
        } catch {}
        throw new Error(`Token validation failed with status ${externalResponse.status}: ${errorBody}`);
    }

    const responseData = await externalResponse.json();
    const phoneNumber = responseData.phone;

    if (!phoneNumber) {
      throw new Error('Phone number not found in token validation response.');
    }

    const user = await prisma.user.findUnique({
      where: { phoneNumber: phoneNumber },
      include: { role: true },
    });
    
    // Always redirect to the homepage. The AuthProvider on the client will handle routing to the dashboard if logged in.
    const response = NextResponse.redirect(new URL('/', req.url));

    if (user) {
      // User exists, log them in by setting a secure auth_token cookie
      const sessionTokenPayload = {
        userId: user.id,
        role: user.role.name,
        permissions: user.role.permissions,
        phoneNumber: user.phoneNumber,
        isGuest: false,
      };

      const sessionToken = jwt.sign(sessionTokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      
      response.cookies.set('auth_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24, // 1 day
      });

    } else {
      // User does not exist, treat them as a guest by creating a temporary guest auth token
      const guestTokenPayload = {
        userId: `guest_${phoneNumber}`, // Create a temporary, non-db guest ID
        phoneNumber: phoneNumber,
        isGuest: true,
      };

      const guestToken = jwt.sign(guestTokenPayload, JWT_SECRET, { expiresIn: GUEST_JWT_EXPIRES_IN });

      response.cookies.set('auth_token', guestToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60, // 1 hour
      });
    }

    return response;

  } catch (error: any) {
    console.error('[PORTAL_CONNECT] Error during SuperApp login:', error.message);
    // On any error, just proceed as a regular guest by redirecting to home
    return NextResponse.redirect(new URL('/', req.url));
  }
}
