
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';

function formatPhoneNumber(phone: string): string {
    if (phone.startsWith('09') && phone.length === 10) {
        return '251' + phone.substring(1);
    }
    if (phone.startsWith('07') && phone.length === 10) {
        return '251' + phone.substring(1);
    }
    // Return as is if it's already in a different format (e.g., 2519...)
    return phone;
}

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

        const nonce = randomBytes(16).toString('hex');
        const expireDate = new Date();
        expireDate.setMinutes(expireDate.getMinutes() + 30); // 30-minute expiry

        const appUrl = process.env.APP_URL;
        if (!appUrl) {
            console.error("APP_URL is not set in environment variables.");
            return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
        }
        
        const totalAmount = Number(price);

        // Create a pending order to be confirmed by the webhook
        const pendingOrder = await prisma.pendingOrder.create({
            data: {
                eventId,
                ticketTypeId,
                attendeeData,
                promoCode,
                status: 'PENDING',
            },
        });

        const arifpayData = {
            cancelUrl: `${appUrl}/events/${eventId}`,
            phone: formatPhoneNumber(attendeeData.phone || '251954926213'),
            email: attendeeData.email || 'telebirrTest@gmail.com', // Use provided email or fallback
            nonce: nonce,
            errorUrl: `${appUrl}/events/${eventId}?error=payment_failed`,
            notifyUrl: `${appUrl}/api/payment/arifpay/notify`,
            successUrl: `${appUrl}/payment/success?transaction_id=${pendingOrder.transactionId}`,
            paymentMethods: ['TELEBIRR'],
            expireDate: expireDate.toISOString(),
            items: [{
                name: name,
                quantity: 1,
                price: totalAmount,
                description: `Ticket for ${event.name}`
            }],
            beneficiaries: [{
                accountNumber: '01320811436100', // Static account number
                bank: 'AWINETAA', // Static bank name
                amount: totalAmount,
            }],
            lang: 'EN',
        };

        const arifpayResponse = await fetch('https://gateway.arifpay.net/api/checkout/session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-arifpay-key': process.env.ARIFPAY_API_KEY!,
            },
            body: JSON.stringify(arifpayData),
        });

        const arifpayResult = await arifpayResponse.json();
        
        if (!arifpayResponse.ok || !arifpayResult.data?.sessionId) {
            console.error('ArifPay API Error:', arifpayResult);
            return NextResponse.json({ error: 'Error communicating with payment gateway.' }, { status: 500 });
        }

        // Update the pending order with the session ID from ArifPay
        await prisma.pendingOrder.update({
            where: { id: pendingOrder.id },
            data: {
                arifpaySessionId: arifpayResult.data.sessionId,
            }
        });

        return NextResponse.json({ paymentUrl: arifpayResult.data.paymentUrl });

    } catch (error: any) {
        console.error('Payment initiation failed:', error);
        return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }
}
