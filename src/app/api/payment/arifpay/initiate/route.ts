
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function formatPhoneNumber(phone: string): string {
    if (phone.startsWith('09') && phone.length === 10) {
        return '251' + phone.substring(1);
    }
    if (phone.startsWith('07') && phone.length === 10) {
        return '251' + phone.substring(1);
    }
    return phone;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { eventId, ticketTypeId, attendeeData, promoCode, items } = body;
        
        if (!eventId || !ticketTypeId || !attendeeData || !items) {
            return NextResponse.json({ error: 'Missing required payment details.' }, { status: 400 });
        }

        const gatewayUrl = process.env.PAYMENT_GATEWAY_URL;
        const apiKey = process.env.PAYMENT_GATEWAY_API_KEY;
        const cbsAccount = process.env.PAYMENT_GATEWAY_CBS_ACCOUNT;

        if (!gatewayUrl || !apiKey || !cbsAccount) {
            console.error("Payment gateway environment variables are not set.");
            return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
        }

        const pendingOrder = await prisma.pendingOrder.create({
            data: {
                eventId,
                ticketTypeId,
                attendeeData,
                promoCode,
                status: 'PENDING',
            },
        });

        const gatewayData = {
            phone: formatPhoneNumber(attendeeData.phone || '251911707917'),
            email: attendeeData.email || 'telebinTest@gmail.com',
            cbs: cbsAccount,
            items: items,
        };

        const gatewayResponse = await fetch(`${gatewayUrl}/create-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Api-Key': apiKey,
            },
            body: JSON.stringify(gatewayData),
        });

        const gatewayResult = await gatewayResponse.json();
        
        if (gatewayResult.ResponseCode !== "0" || !gatewayResult.Data?.URL) {
            console.error('Payment Gateway API Error:', gatewayResult);
            return NextResponse.json({ error: gatewayResult.ResponseDescription || 'Error communicating with payment gateway.' }, { status: 500 });
        }
        
        const sessionId = gatewayResult.Data.NA;
        
        await prisma.pendingOrder.update({
            where: { id: pendingOrder.id },
            data: { arifpaySessionId: sessionId },
        });

        return NextResponse.json({ paymentUrl: gatewayResult.Data.URL, sessionId: sessionId });

    } catch (error: any) {
        console.error('Payment initiation failed:', error);
        return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }
}
