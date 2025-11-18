
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

// This route provides non-sensitive session data for the client,
// including data from the secure auth token and the insecure guest cookie.
export async function GET(req: NextRequest) {
    const cookieStore = cookies();
    let responseData: { [key: string]: any } = {};

    // 1. Try to get data from the secure JWT auth token (for logged-in users)
    const authToken = cookieStore.get('auth_token')?.value;
    if (authToken && JWT_SECRET) {
        try {
            const decoded = jwt.verify(authToken, JWT_SECRET) as { userId: string, phoneNumber?: string };
            if (decoded.userId) {
                // If the token is valid, we can add user info to our response
                responseData.userId = decoded.userId;
                // If phone number is in the token, add it too.
                if (decoded.phoneNumber) {
                    responseData.phoneNumber = decoded.phoneNumber;
                }
            }
        } catch (error) {
            console.log("Auth token is present but invalid. Proceeding as guest.");
        }
    }

    // 2. Check for the client-readable phone_number cookie (for SuperApp guests)
    const guestPhoneCookie = cookieStore.get('phone_number')?.value;
    if (guestPhoneCookie && !responseData.phoneNumber) {
        // Only use the guest cookie if a logged-in user's phone isn't already set
        responseData.phoneNumber = guestPhoneCookie;
    }
    
    // 3. Return whatever data was found
    if (Object.keys(responseData).length > 0) {
        return NextResponse.json({ success: true, data: responseData });
    } else {
        return NextResponse.json({ success: false, message: "No session data found." }, { status: 404 });
    }
}
