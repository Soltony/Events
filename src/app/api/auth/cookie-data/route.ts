'use server';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decryptSessionPayload } from '@/lib/sessionCrypto';

/**
 * GET endpoint to retrieve authentication data from HTTP-only cookies
 * This allows client-side code to access data stored in HTTP-only cookies
 */
export async function GET(req: NextRequest) {
  try {
    const cookie = cookies().get('auth');
    if (!cookie?.value) {
      return NextResponse.json(
        { success: false, message: 'No authentication data found' },
        { status: 401 }
      );
    }
    
    const decrypted = await decryptSessionPayload(cookie.value);
    const authData = JSON.parse(decrypted);
    
    const { phoneNumber, accessToken } = authData;
    
    return NextResponse.json({
      success: true,
      data: {
        phoneNumber,
        isAuthenticated: !!accessToken
      }
    });
  } catch (error) {
    console.error('Error retrieving cookie data:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve authentication data' },
      { status: 500 }
    );
  }
}
