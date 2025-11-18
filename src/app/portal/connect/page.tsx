'use server';

import { headers } from 'next/headers';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import PublicHomePage from '@/app/page';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '1d';
const VALIDATE_TOKEN_URL = process.env.NIB_VALIDATE_TOKEN_URL; // You must set this in your .env

async function handleSuperAppLogin() {
  if (!VALIDATE_TOKEN_URL || !JWT_SECRET) {
    console.error('[PORTAL_CONNECT] Server is missing NIB_VALIDATE_TOKEN_URL or JWT_SECRET environment variables.');
    // In production, we might just redirect to home without logging in.
    // For now, we'll let it proceed to show the homepage as a guest.
    return;
  }
  
  const headerList = headers();
  const authHeader = headerList.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[PORTAL_CONNECT] No valid SuperApp authorization header found. Proceeding as guest.');
    return;
  }

  try {
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

    if (user) {
      // User exists, log them in by setting a secure auth_token cookie
      const sessionTokenPayload = {
        userId: user.id,
        role: user.role.name,
        permissions: user.role.permissions,
      };

      const sessionToken = jwt.sign(sessionTokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      
      cookies().set('auth_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24, // 1 day
      });
      
      // Redirect to dashboard after successful login
      return redirect('/dashboard');
      
    } else {
      // User does not exist, treat them as a guest
      // Set a client-readable cookie with their phone number for pre-filling forms
      cookies().set('phone_number', phoneNumber, {
        httpOnly: false, // Make it readable by client-side JS
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 1 week
      });

      // Redirect to homepage to load it cleanly as a guest
      return redirect('/');
    }

  } catch (error: any) {
    console.error('[PORTAL_CONNECT] Error during SuperApp login:', error.message);
    // On any error, just proceed as a regular guest by redirecting to home
    return redirect('/');
  }
}

export default async function PortalConnectPage() {
    // Run the server-side logic. It will either redirect or complete.
    const result = await handleSuperAppLogin();

    if (result) {
        // This won't be hit if a redirect occurs, but it's good practice.
        return result;
    }
  
    // If no redirect happens (e.g., in case of a silent failure), render the homepage.
    return <PublicHomePage />;
}
