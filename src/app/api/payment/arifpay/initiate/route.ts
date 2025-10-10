
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';

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
        const { eventId, tickets, promoCode, attendeeDetails, mock } = body;

        if (!eventId || !tickets?.length || !attendeeDetails) {
            return NextResponse.json({
                error: 'Invalid request payload',
                detail: 'Required fields: eventId, tickets[], attendeeDetails. Make sure at least one ticket is in the cart.'
            }, { status: 400 });
        }

        const event = await prisma.event.findUnique({ where: { id: eventId } });

        if (!event?.nibBankAccount && !mock) {
            return NextResponse.json({
                error: 'Payout account not configured',
                detail: 'The event organizer has not configured a NIB bank account; payment cannot be processed yet.'
            }, { status: 404 });
        }

        const totalAmount = (tickets as Array<{ price: number; quantity: number }>).reduce((sum: number, t) => sum + Number(t.price) * Number(t.quantity), 0);
        const totalQuantity = (tickets as Array<{ quantity: number }>).reduce((sum: number, t) => sum + Number(t.quantity), 0);
        const transactionId = randomBytes(16).toString('hex');

        // Create the pending order first without the ArifPay session ID.
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

        if (mock) {
            return NextResponse.json({ pendingOrder });
        }

        const paymentGatewayUrl = process.env.BASE_URL;
        const apiKey = process.env.ARIFPAY_API_KEY;
        const failureUrl = `${process.env.FAILURE_URL}?event_id=${eventId}`;
        const callbackUrl = process.env.ARIFPAY_CALLBACK_URL;
        const successUrl = `${process.env.SUCCESS_URL}?transaction_id=${transactionId}`;

        if (!paymentGatewayUrl || !apiKey || !failureUrl || !callbackUrl || !successUrl) {
            console.error("Payment gateway URL, API key, or callback/redirect URLs are missing.");
            return NextResponse.json({
                error: 'Server configuration error',
                detail: 'Payment gateway credentials or callback/redirect URLs are missing. Please contact support.',
                pendingOrder
            }, { status: 500 });
        }

        const paymentGatewayData = {
            phone: formatPhoneNumber(attendeeDetails.phone),
            email: `${formatPhoneNumber(attendeeDetails.phone)}@nibticket.com`,
            cbs: event!.nibBankAccount!,
            items: [{ name: event!.name, quantity: totalQuantity, price: totalAmount, description: event!.description }],
        };
  
            console.log(paymentGatewayData);
        let paymentGatewayResponse;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); 

            paymentGatewayResponse = await fetch(`${paymentGatewayUrl}/api/payment/createsession`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Api-Key': apiKey },
                body: JSON.stringify(paymentGatewayData),
                signal: controller.signal,
            });

            console.log("Payment Gateway Response:", paymentGatewayResponse);
            
            clearTimeout(timeoutId);

        } catch (networkError: any) {
            if (networkError.name === 'AbortError') {
                 console.error("ArifPay API call timed out:", networkError);
                 return NextResponse.json({
                    error: 'Payment gateway timeout',
                    detail: 'We could not establish a session with ArifPay within 15 seconds. Please try again.',
                    pendingOrder
                 }, { status: 504 });
            }
            console.error("Network error while connecting to ArifPay:", networkError);
            return NextResponse.json({
                error: 'Payment gateway unreachable',
                detail: 'A network error occurred while contacting ArifPay. Check your connection and try again.',
                pendingOrder
            }, { status: 503 });
        }
        
        const rawText = await paymentGatewayResponse.text();
        let paymentGatewayResult: any;
        try {
            paymentGatewayResult = JSON.parse(rawText);
        } catch (parseError) {
            console.error("Failed to parse ArifPay response as JSON:", rawText);
            return NextResponse.json({
                error: 'Invalid gateway response',
                detail: 'ArifPay returned a non‑JSON response. Please try again later.',
                pendingOrder
            }, { status: 502 });
        }

        if (paymentGatewayResult.ResponseCode !== "0" || !paymentGatewayResult.Data?.URL || !paymentGatewayResult.Data?.NA) {
            console.error('Payment Gateway API Error:', paymentGatewayResult);
            return NextResponse.json({
                error: 'Payment session creation failed',
                detail: paymentGatewayResult.ResponseDescription || 'The gateway did not accept the session request. Please verify organizer payout setup and try again.',
                pendingOrder
            }, { status: 502 });
        }
        
        await prisma.pendingOrder.update({
            where: { id: pendingOrder.id },
            data: { arifpaySessionId: paymentGatewayResult.Data.NA },
        });
        const finalSuccessUrl = `${process.env.SUCCESS_URL}?transaction_id=${transactionId}&session_id=${paymentGatewayResult.Data.NA}`;
        return NextResponse.json({ paymentUrl: paymentGatewayResult.Data.URL, successUrl: finalSuccessUrl, pendingOrder });
    } catch (error: any) {
        console.error('Payment initiation failed:', error);
        return NextResponse.json({
            error: 'Unexpected server error',
            detail: error.message || 'An unknown error occurred while initiating the payment.'
        }, { status: 500 });
    }
}
