
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { randomUUID, createHash } from 'crypto';
import { format } from 'date-fns';

function formatPhoneNumber(phone: string): string {
    if ((phone.startsWith('09') || phone.startsWith('07')) && phone.length === 10) {
        return '251' + phone.substring(1);
    }
    return phone;
}

export async function POST(req: NextRequest) {
    if (req.method !== 'POST') {
        return NextResponse.json({
            error: 'Method Not Allowed',
            detail: 'Use HTTP POST to initiate a payment session.'
        }, { status: 405 });
    }
    try {
        const body = await req.json();
        const { eventId, tickets, promoCode, attendeeDetails, authToken, mock } = body;

        if (!eventId || !tickets?.length || !attendeeDetails) {
            return NextResponse.json({
                error: 'Invalid request payload',
                detail: 'Required fields: eventId, tickets[], attendeeDetails. Make sure at least one ticket is in the cart.'
            }, { status: 400 });
        }

        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) {
             return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        if (!event?.nibBankAccount && !mock) {
            return NextResponse.json({
                error: 'Payout account not configured',
                detail: 'The event organizer has not configured a NIB bank account; payment cannot be processed yet.'
            }, { status: 404 });
        }

        const totalAmount = (tickets as Array<{ price: number; quantity: number }>).reduce((sum: number, t) => sum + Number(t.price) * Number(t.quantity), 0);
        const totalQuantity = (tickets as Array<{ quantity: number }>).reduce((sum: number, t) => sum + Number(t.quantity), 0);
        
        const transactionId = randomUUID();
        const transactionTime = format(new Date(), 'yyyyMMddHHmmss');
        const callBackURL = process.env.ARIFPAY_CALLBACK_URL || '/api/payment/arifpay/notify'; // Re-using for now

        const ACCOUNT_NO = process.env.NIB_ACCOUNT_NO;
        const COMPANY_NAME = process.env.NIB_COMPANY_NAME;
        const NIB_PAYMENT_KEY = process.env.NIB_PAYMENT_KEY;
        const NIB_PAYMENT_URL = process.env.NIB_PAYMENT_URL;

        if (!ACCOUNT_NO || !COMPANY_NAME || !NIB_PAYMENT_KEY || !NIB_PAYMENT_URL) {
            console.error("NIB Payment Gateway environment variables are not set.");
            return NextResponse.json({
                error: 'Server configuration error',
                detail: 'NIB Payment gateway credentials are missing. Please contact support.',
            }, { status: 500 });
        }
        
        // The token is now passed in the request body from purchaseTickets action
        if (!authToken) {
             return NextResponse.json({ error: 'Authentication token is missing.' }, { status: 401 });
        }

        // Create the pending order first
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
            console.error("NIB Payment Gateway Error:", errorText);
            return NextResponse.json({ error: 'Payment gateway rejected the request.', detail: errorText }, { status: response.status });
        }

        const responseData = await response.json();
        const paymentToken = responseData.token;

        if (responseData.responseCode === '00' && paymentToken) {
            await prisma.pendingOrder.update({
                where: { id: pendingOrder.id },
                data: { arifpaySessionId: transactionId }, // Use our transactionId as the session identifier
            });

            return NextResponse.json({ 
                paymentToken: paymentToken,
                transactionId: transactionId,
            });
        } else {
            console.error('Payment session creation failed:', responseData);
            return NextResponse.json({
                error: 'Payment session creation failed',
                detail: responseData.responseMessage || 'The gateway did not return a valid payment token.',
                pendingOrder
            }, { status: 502 });
        }

    } catch (error: any) {
        console.error('Payment initiation failed:', error);
        return NextResponse.json({
            error: 'Unexpected server error',
            detail: error.message || 'An unknown error occurred while initiating the payment.'
        }, { status: 500 });
    }
}
