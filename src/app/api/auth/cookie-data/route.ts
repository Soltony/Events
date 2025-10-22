'use server';

import { NextRequest, NextResponse } from 'next/server';
import { getSecureCookie } from '@/lib/cookieUtils';

/**
 * GET endpoint to retrieve authentication data from HTTP-only cookies
 * This allows client-side code to access data stored in HTTP-only cookies
 */
export async function GET(req: NextRequest) {
  try {
    // Get auth data from the secure cookie
    const authData = await getSecureCookie('auth');
    
    if (!authData) {
      return NextResponse.json(
        { success: false, message: 'No authentication data found' },
        { status: 401 }
      );
    }
    
    // Extract only the data we want to expose to the client
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