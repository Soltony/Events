

'use server';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET;

// This route provides non-sensitive session data for the client,
// including data from the secure auth token and the insecure guest cookie.
export async function GET(req: NextRequest) {
    const cookieStore = cookies();
    let responseData: { [key: string]: any } = {};

    // 1. ALWAYS read from SuperApp cookie first
    const guestPhoneCookie = cookieStore.get('phone_number')?.value;
    if (guestPhoneCookie) {
        responseData.phoneNumber = guestPhoneCookie;
    }

    // 2. Only if cookie does NOT exist, fallback to auth token user profile
    const authToken = cookieStore.get('auth_token')?.value;
    if (!responseData.phoneNumber && authToken && JWT_SECRET) {
        try {
            const decoded = jwt.verify(authToken, JWT_SECRET) as { userId: string };
            if (decoded.userId) {
                const user = await prisma.user.findUnique({
                    where: { id: decoded.userId },
                    select: { phoneNumber: true }
                });
                if (user?.phoneNumber) {
                    responseData.phoneNumber = user.phoneNumber;
                }
            }
        } catch (error) {
            console.log("Invalid auth token. Proceeding as guest.");
        }
    }
    
    // 3. Return whatever data was found
    if (Object.keys(responseData).length > 0) {
        return NextResponse.json({ success: true, data: responseData });
    } else {
        return NextResponse.json({ success: false, message: "No session data found." }, { status: 404 });
    }
}
