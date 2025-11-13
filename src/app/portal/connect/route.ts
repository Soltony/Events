
'use server';

import { headers } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { encryptSessionPayload } from '@/lib/sessionCrypto';
import { redirect } from 'next/navigation';

export async function GET(request: NextRequest) {
  try {
    const headerList = await headers();
    const authHeader = headerList.get('Authorization');

    if (!authHeader) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Authorization header is missing from the request.',
        },
        { status: 401 }
      );
    }

    const bearerPrefix = 'Bearer ';
    if (!authHeader.startsWith(bearerPrefix)) {
      return NextResponse.json(
        {
          status: 'error',
          message:
            'Authorization header is malformed. It must start with "Bearer ".',
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(bearerPrefix.length);

    if (!token) {
        return NextResponse.json(
        {
          status: 'error',
          message: 'Bearer token is missing.',
        },
        { status: 401 }
      );
    }
    
    const validationUrl = process.env.VALIDATE_TOKEN_URL;
    if (!validationUrl) {
      console.error('VALIDATE_TOKEN_URL environment variable is not set.');
      return NextResponse.json(
        {
          status: 'error',
          message: 'Server configuration error.',
        },
        { status: 500 }
      );
    }
    
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
        return NextResponse.json(
            {
                status: 'error',
                message: `Token validation failed: ${externalResponse.statusText}`,
                details: errorText,
            },
            { status: externalResponse.status }
        );
    }
    
    const validationResult = await externalResponse.json();
    const phoneNumber = validationResult.phone;

    if (!phoneNumber) {
        return NextResponse.json({ status: 'error', message: 'Phone number not found in validation response.'}, { status: 400 });
    }

    // This is an end-user session, not tied to a registered user in our DB.
    // The session payload contains the phone number and original token.
    const sessionPayload = {
      accessToken: token,
      phoneNumber: phoneNumber,
    };

    const encrypted = await encryptSessionPayload(JSON.stringify(sessionPayload));

    // Create a response object to set the cookie on
    const response = NextResponse.redirect(new URL('/', request.url));

    // Set the cookie on the response object
    response.cookies.set('auth', encrypted, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });

    // Return the response with the cookie
    return response;

  } catch (error: any) {
    // This is a special Next.js error type used for redirects.
    // We must re-throw it to allow the redirect to happen.
    if (error.digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    
    console.error('Error processing connect request:', error);
    // Return a generic error page or response for all other errors
    return NextResponse.json(
      {
        status: 'error',
        message: 'An unexpected server error occurred during connection.',
      },
      { status: 500 }
    );
  }
}
