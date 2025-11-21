
'use server';

import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const VALIDATE_TOKEN_URL = process.env.VALIDATE_TOKEN_URL;
const COOKIE_MAX_AGE = 60 * 60 * 24; // 1 day

export async function GET(req: NextRequest) {
  if (!VALIDATE_TOKEN_URL || !JWT_SECRET) {
    console.error('[PORTAL_CONNECT] Server is missing VALIDATE_TOKEN_URL or JWT_SECRET environment variables.');
    return NextResponse.redirect(new URL('/', req.url));
  }
  
  const headerList = headers();
  const authHeader = headerList.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[PORTAL_CONNECT] No valid SuperApp authorization header found. Proceeding as guest.');
    return NextResponse.redirect(new URL('/', req.url));
  }

  try {
    const superAppToken = authHeader.substring(7);
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
    
    // Always redirect to the homepage. The AuthProvider on the client will handle routing.
    const response = NextResponse.redirect(new URL('/', req.url));
    
    // --- CORRECTED LOGIC ---
    // Store the raw SuperApp token in its own cookie for payment initiation
    response.cookies.set('superapp_token', superAppToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE,
    });
    
    // Check if the user exists in our DB
    const user = await prisma.user.findUnique({
        where: { phoneNumber }
    });

    let internalTokenPayload: any;
    if (user) {
        internalTokenPayload = {
            userId: user.id,
            isGuest: false,
        };
    } else {
        internalTokenPayload = {
            userId: `guest_${phoneNumber}`,
            phoneNumber: phoneNumber,
            isGuest: true,
        };
    }

    // Create our app's internal JWT
    const internalToken = jwt.sign(internalTokenPayload, JWT_SECRET, {
        expiresIn: '1d',
    });
    
    // Set our app's internal auth token cookie
    response.cookies.set('auth_token', internalToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE,
    });

    return response;

  } catch (error: any) {
    console.error('[PORTAL_CONNECT] Error during SuperApp login:', error.message);
    // On any error, just proceed as a regular guest by redirecting to home
    return NextResponse.redirect(new URL('/', req.url));
  }
}
