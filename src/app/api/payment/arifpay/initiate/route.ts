
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { randomUUID, createHash } from 'crypto';
import { format } from 'date-fns';

export async function POST(req: NextRequest) {
    if (req.method !== 'POST') {
        return NextResponse.json({
            error: 'Method Not Allowed',
            detail: 'Use HTTP POST to initiate a payment session.'
        }, { status: 405 });
    }
    
    const transactionId = randomUUID();
    
    const ACCOUNT_NO = process.env.NIB_ACCOUNT_NO;
    const COMPANY_NAME = process.env.NIB_COMPANY_NAME;
    const NIB_PAYMENT_KEY = process.env.NIB_PAYMENT_KEY;
    const NIB_PAYMENT_URL = process.env.NIB_PAYMENT_URL;

    if (!ACCOUNT_NO || !COMPANY_NAME || !NIB_PAYMENT_KEY || !NIB_PAYMENT_URL) {
        console.error(`[TX:${transactionId}] NIB Payment Gateway environment variables are not set.`);
        return NextResponse.json({
            error: 'Server configuration error',
            detail: 'Payment gateway credentials are missing. Please contact support.',
        }, { status: 500 });
    }

    try {
        new URL(NIB_PAYMENT_URL);
    } catch (e) {
        console.error(`[TX:${transactionId}] Invalid NIB_PAYMENT_URL provided in environment variables.`);
        return NextResponse.json({ error: 'Server configuration error', detail: 'Payment gateway URL is misconfigured.' }, { status: 500 });
    }


    try {
        const body = await req.json();
        const { eventId, tickets, promoCode, attendeeDetails, authToken } = body;

        if (!eventId || !tickets?.length || !attendeeDetails || !authToken) {
            return NextResponse.json({
                error: 'Invalid request payload',
                detail: 'Required fields: eventId, tickets[], attendeeDetails, authToken. Make sure at least one ticket is in the cart.'
            }, { status: 400 });
        }

        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event || !event.nibBankAccount) {
             return NextResponse.json({ 
                error: 'Event not found or payout account not configured',
                detail: 'The event organizer has not configured a NIB bank account; payment cannot be processed yet.'
             }, { status: 404 });
        }

        const totalAmount = (tickets as Array<{ price: number; quantity: number }>).reduce((sum: number, t) => sum + Number(t.price) * Number(t.quantity), 0);
        const totalQuantity = (tickets as Array<{ quantity: number }>).reduce((sum: number, t) => sum + Number(t.quantity), 0);
        
        const transactionTime = format(new Date(), 'yyyyMMddHHmmss');
        const callBackURL = `${process.env.APP_URL}/api/payment/arifpay/notify`;
        
        const pendingOrder = await prisma.pendingOrder.create({
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

        const signatureString = [
            `accountNo=${ACCOUNT_NO}`,
            `amount=${totalAmount}`,
            `callBackURL=${callBackURL}`,
            `companyName=${COMPANY_NAME}`,
            `Key=${NIB_PAYMENT_KEY}`,
            `token=${authToken}`,
            `transactionId=${transactionId}`,
            `transactionTime=${transactionTime}`
        ].join('&');

        const signature = createHash('sha256').update(signatureString, 'utf8').digest('hex');

        const payload = {
            accountNo: ACCOUNT_NO,
            amount: String(totalAmount),
            callBackURL: callBackURL,
            companyName: COMPANY_NAME,
            token: authToken,
            transactionId: transactionId,
            transactionTime: transactionTime,
            signature: signature
        };

        const response = await fetch(NIB_PAYMENT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[TX:${transactionId}] NIB Payment Gateway Error. Status: ${response.status}. Body: ${errorText}`);
            return NextResponse.json({ error: 'Payment gateway rejected the request.', detail: `Transaction failed. Please contact support with reference: ${transactionId}` }, { status: response.status });
        }

        const responseData = await response.json();
        const paymentToken = responseData.token;

        if (paymentToken) {
            return NextResponse.json({
                paymentToken: paymentToken,
                transactionId: transactionId,
            });
        } else {
            console.error(`[TX:${transactionId}] Payment session creation failed. Response: ${JSON.stringify(responseData)}`);
            return NextResponse.json({
                error: 'Payment session creation failed',
                detail: `The gateway did not return a valid payment token. Please contact support with reference: ${transactionId}`,
            }, { status: 502 });
        }

    } catch (error: any) {
        console.error(`[TX:${transactionId}] Payment initiation failed:`, error.message);
        return NextResponse.json({
            error: 'Unexpected server error',
            detail: `An unknown error occurred. Please contact support with reference: ${transactionId}`
        }, { status: 500 });
    }
}
