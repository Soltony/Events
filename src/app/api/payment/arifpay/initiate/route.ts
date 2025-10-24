
'use server';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createHash } from 'crypto';
import { format } from 'date-fns';
import { decryptSessionPayload } from '@/lib/sessionCrypto';
import { cookies } from 'next/headers';

async function sha256(message: string) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}


export async function POST(req: NextRequest) {
    if (req.method !== 'POST') {
        return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
    }

    try {
        const body = await req.json();
        const { eventId, tickets, promoCode, attendeeDetails, amount } = body;

        if (!eventId || !tickets?.length || !attendeeDetails || amount === undefined) {
            return NextResponse.json({
                error: 'Invalid request payload',
                detail: 'Required fields: eventId, tickets[], attendeeDetails, amount.'
            }, { status: 400 });
        }
        
        // --- Fetch auth token from secure session cookie ---
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('auth');
        if (!sessionCookie?.value) {
            return NextResponse.json({ error: 'Unauthorized', detail: 'User session not found.' }, { status: 401 });
        }
        const decryptedSession = await decryptSessionPayload(sessionCookie.value);
        const { accessToken: authToken } = JSON.parse(decryptedSession);
        
        if (!authToken) {
            return NextResponse.json({ error: 'Unauthorized', detail: 'Invalid session token.' }, { status: 401 });
        }

        // --- Get env variables for payment gateway ---
        const ACCOUNT_NO = process.env.NEXT_PUBLIC_NIB_ACCOUNT_NO;
        const COMPANY_NAME = process.env.NEXT_PUBLIC_NIB_COMPANY_NAME;
        const NIB_PAYMENT_KEY = process.env.NEXT_PUBLIC_NIB_PAYMENT_KEY;
        const NIB_PAYMENT_URL = process.env.NEXT_PUBLIC_NIB_PAYMENT_URL;
        const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

        if (!ACCOUNT_NO || !COMPANY_NAME || !NIB_PAYMENT_KEY || !NIB_PAYMENT_URL || !APP_URL) {
            console.error("Payment gateway configuration is missing on the server.");
            return NextResponse.json({ error: 'Server Configuration Error', detail: 'Payment gateway is not properly configured.' }, { status: 500 });
        }

        const transactionId = crypto.randomUUID();
        const transactionTime = format(new Date(), 'yyyyMMddHHmmss');
        const callBackURL = `${APP_URL}/api/payment/arifpay/notify`;
        
        const signatureString = [
            `accountNo=${ACCOUNT_NO}`,
            `amount=${amount}`,
            `callBackURL=${callBackURL}`,
            `companyName=${COMPANY_NAME}`,
            `Key=${NIB_PAYMENT_KEY}`,
            `token=${authToken}`,
            `transactionId=${transactionId}`,
            `transactionTime=${transactionTime}`
        ].join('&');
        
        const signature = await sha256(signatureString);

        const payload = {
            accountNo: ACCOUNT_NO,
            amount: String(amount),
            callBackURL: callBackURL,
            companyName: COMPANY_NAME,
            token: authToken,
            transactionId: transactionId,
            transactionTime: transactionTime,
            signature: signature
        };

        // --- Store Pending Order Before Payment ---
        const totalQuantity = (tickets as Array<{ quantity: number }>).reduce((sum: number, t) => sum + Number(t.quantity), 0);
        await prisma.pendingOrder.create({
            data: {
                transactionId: transactionId,
                eventId,
                ticketTypeId: tickets[0].id,
                attendeeData: {
                    name: attendeeDetails.name,
                    phoneNumber: attendeeDetails.phone,
                    userId: attendeeDetails.userId,
                    quantity: totalQuantity,
                },
                promoCode,
                status: 'PENDING',
                arifpaySessionId: transactionId,
            },
        });

        // --- Call Payment Gateway ---
        const gatewayResponse = await fetch(NIB_PAYMENT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(payload),
        });

        const responseData = await gatewayResponse.json();

        if (!gatewayResponse.ok || !responseData.token) {
            console.error("Gateway Error:", responseData);
            return NextResponse.json({
                error: 'Gateway Error',
                detail: responseData.detail || responseData.error || "Failed to get payment token from gateway."
            }, { status: gatewayResponse.status });
        }

        // --- Return token to client ---
        return NextResponse.json({
            success: true,
            paymentToken: responseData.token,
            transactionId: transactionId
        });
        
    } catch (error: any) {
        console.error(`[Payment Init] Unexpected error:`, error.message);
        return NextResponse.json({
            error: 'Unexpected server error',
            detail: `An unknown error occurred. Please contact support.`
        }, { status: 500 });
    }
}
