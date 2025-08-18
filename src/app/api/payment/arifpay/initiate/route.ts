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
    try {
        const body = await req.json();
        const { eventId, tickets, promoCode, attendeeDetails } = body;

        if (!eventId || !tickets || !Array.isArray(tickets) || tickets.length === 0 || !attendeeDetails) {
            return NextResponse.json({ error: 'Missing required payment details.' }, { status: 400 });
        }

        const event = await prisma.event.findUnique({
            where: { id: eventId },
        });

        if (!event || !event.nibBankAccount) {
            return NextResponse.json({ error: 'Event or organizer Nib bank account not found.' }, { status: 404 });
        }

        const totalAmount = tickets.reduce((sum, ticket) => sum + (ticket.price * ticket.quantity), 0);
        const totalQuantity = tickets.reduce((sum, ticket) => sum + ticket.quantity, 0);

        const transactionId = randomBytes(16).toString('hex');

        // ✅ Ensure attendeeData is stored in JSON column
        const pendingOrder = await prisma.pendingOrder.create({
            data: {
                //transactionId,
                eventId,
                ticketTypeId: tickets[0].id, // first ticket type
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

        const paymentGatewayUrl = process.env.BASE_URL;
        const apiKey = process.env.ARIFPAY_API_KEY;
        const successUrl = `${process.env.SUCCESS_URL}?transaction_id=${transactionId}&event_id=${eventId}`;
        const failureUrl = `${process.env.FAILURE_URL}?event_id=${eventId}`;

        if (!paymentGatewayUrl || !apiKey || !process.env.SUCCESS_URL || !process.env.FAILURE_URL) {
            console.error("Payment gateway URL or API key is not configured.");
            return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
        }

        const paymentGatewayData = {
            phone: formatPhoneNumber(attendeeDetails.phone),
            email: `${formatPhoneNumber(attendeeDetails.phone)}@nibticket.com`,
            cbs: event.nibBankAccount,
            items: [{
                name: event.name,
                quantity: totalQuantity,
                price: totalAmount,
                description: event.description,
            }],
            successUrl,
            failureUrl,
        };

        const paymentGatewayResponse = await fetch(`${paymentGatewayUrl}/api/payment/createsession`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Api-Key': apiKey,
            },
            body: JSON.stringify(paymentGatewayData),
        });

        // ✅ Log raw response first
        const rawText = await paymentGatewayResponse.text();
        console.log("ArifPay raw response:", rawText);

        let paymentGatewayResult: any;
        try {
            paymentGatewayResult = JSON.parse(rawText);
        } catch (e) {
            console.error("Failed to parse ArifPay response as JSON", e);
            return NextResponse.json({ error: 'Invalid response from payment gateway.' }, { status: 502 });
        }

        if (paymentGatewayResult.ResponseCode !== "0" || !paymentGatewayResult.Data?.URL || !paymentGatewayResult.Data?.NA) {
            console.error('Payment Gateway API Error:', paymentGatewayResult);
            return NextResponse.json({ error: paymentGatewayResult.ResponseDescription || 'Error communicating with payment gateway.' }, { status: 502 });
        }

        await prisma.pendingOrder.update({
            where: { id: pendingOrder.id },
            data: { arifpaySessionId: paymentGatewayResult.Data.NA },
        });

        return NextResponse.json({ paymentUrl: paymentGatewayResult.Data.URL });

    } catch (error: any) {
        console.error('Payment initiation failed:', error);
        return NextResponse.json({ error: error.message || 'An unexpected error occurred.' }, { status: 500 });
    }
}
