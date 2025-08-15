
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
            include: { organizer: true }
        });

        if (!event || !event.organizer) {
             return NextResponse.json({ error: 'Event or organizer CBS account not found.' }, { status: 404 });
        }

        const totalAmount = tickets.reduce((sum, ticket) => sum + (ticket.price * ticket.quantity), 0);
        const totalQuantity = tickets.reduce((sum, ticket) => sum + ticket.quantity, 0);

        const pendingOrder = await prisma.pendingOrder.create({
            data: {
                eventId,
                ticketTypeId: tickets[0].id, // For simplicity, associate with the first ticket type
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

        const paymentGatewayUrl = `${process.env.BASE_URL}/api/payment/createsession`;
        const apiKey = process.env.ARIFPAY_API_KEY;

        if (!paymentGatewayUrl || !apiKey) {
            console.error("Payment gateway URL or API key is not configured.");
            return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
        }

        const paymentGatewayData = {
            phone: formatPhoneNumber(attendeeDetails.phone),
            email: `${formatPhoneNumber(attendeeDetails.phone)}@nibticket.com`,
            cbs: "7000101633395",
            items: [{
                name: event.name,
                quantity: totalQuantity,
                price: totalAmount,
                description: event.description,
            }],
        };

        console.log("Payment Gateway Data:", paymentGatewayData);

        const paymentGatewayResponse = await fetch(paymentGatewayUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Api-Key': apiKey,
            },
            body: JSON.stringify(paymentGatewayData),
        });

        console.log("Payment Gateway Response:", paymentGatewayResponse);

        const paymentGatewayResult = await paymentGatewayResponse.json();
        
        if (paymentGatewayResult.responseCode !== "0" || !paymentGatewayResult.data?.url || !paymentGatewayResult.data?.na) {
            console.error('Payment Gateway API Error:', paymentGatewayResult);
            return NextResponse.json({ error: paymentGatewayResult.responseDescription || 'Error communicating with payment gateway.' }, { status: 500 });
        }

        await prisma.pendingOrder.update({
            where: { id: pendingOrder.id },
            data: {
                arifpaySessionId: paymentGatewayResult.data.na,
            }
        });

        return NextResponse.json({ paymentUrl: paymentGatewayResult.data.url });

    } catch (error: any) {
        console.error('Payment initiation failed:', error);
        return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }
}
