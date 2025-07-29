
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { eventId, ticketTypeId, quantity, price, name, attendeeData, promoCode } = body;
        
        if (!eventId || !ticketTypeId || !quantity || !price || !name || !attendeeData) {
            return NextResponse.json({ error: 'Missing required payment details.' }, { status: 400 });
        }

        const event = await prisma.event.findUnique({ where: { id: eventId }});
        if (!event) {
             return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
        }

        // Prepare the request data for ArifPay
        const nonce = randomBytes(16).toString('hex');
        const expireDate = new Date();
        expireDate.setMinutes(expireDate.getMinutes() + 30); // 30-minute expiry

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

        const data = {
            cancelUrl: `${appUrl}/events/${eventId}`,
            nonce: nonce,
            errorUrl: `${appUrl}/events/${eventId}`,
            notifyUrl: `${appUrl}/api/payment/arifpay/notify`,
            successUrl: `${appUrl}/payment/success`, // A generic success page
            paymentMethods: ['TELEBIRR'],
            expireDate: expireDate.toISOString(),
            items: [{
                name: name,
                quantity: quantity,
                price: price,
                description: `Ticket for ${event.name}`
            }],
            beneficiaries: [{
                accountNumber: '01320811436100', // Static account for now
                bank: 'AWINETAA',
                amount: price * quantity
            }],
        };

        const arifpayResponse = await fetch('https://gateway.arifpay.net/api/checkout/session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-arifpay-key': process.env.ARIFPAY_API_KEY!,
            },
            body: JSON.stringify(data),
        });

        const arifpayResult = await arifpayResponse.json();
        
        if (!arifpayResponse.ok || !arifpayResult.data?.sessionId) {
            console.error('ArifPay API Error:', arifpayResult);
            return NextResponse.json({ error: 'Error communicating with payment gateway.' }, { status: 500 });
        }

        // Create a pending order to be confirmed by the webhook
        await prisma.pendingOrder.create({
            data: {
                arifpaySessionId: arifpayResult.data.sessionId,
                eventId,
                ticketTypeId,
                attendeeData,
                promoCode,
                status: 'PENDING',
            },
        });

        return NextResponse.json({ paymentUrl: arifpayResult.data.paymentUrl });

    } catch (error: any) {
        console.error('Payment initiation failed:', error);
        return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }
}
