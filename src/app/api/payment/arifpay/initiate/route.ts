
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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
        const { eventId, tickets, attendeeData, promoCode } = body;

        if (!eventId || !tickets || !Array.isArray(tickets) || tickets.length === 0 || !attendeeData) {
            return NextResponse.json({ error: 'Missing required payment details.' }, { status: 400 });
        }
        
        const paymentGatewayUrl = process.env.BASE_URL;
        const apiKey = process.env.ARIFPAY_API_KEY;

        if (!paymentGatewayUrl || !apiKey) {
            console.error("Payment gateway environment variables are not set.");
            return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
        }

        const event = await prisma.event.findUnique({ where: { id: eventId }});
        if (!event) {
             return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
        }

        const organizer = await prisma.user.findUnique({ where: { id: event.organizerId }});
        if (!organizer || !organizer.cbsAccount) {
            return NextResponse.json({ error: 'Event organizer or CBS Account not configured.' }, { status: 404 });
        }
        
        // Create a pending order to be confirmed by the webhook
        const pendingOrder = await prisma.pendingOrder.create({
            data: {
                eventId,
                ticketTypeId: tickets[0].id, // Store a representative ticket type
                attendeeData, // This now contains name, phone, email, userId, quantity
                promoCode,
                status: 'PENDING',
            },
        });

        const itemsForGateway = tickets.map((ticket: { name: any; quantity: any; price: any; }) => ({
            name: `${event.name} - ${ticket.name}`,
            quantity: ticket.quantity,
            price: Number(ticket.price),
            description: `Event Ticket`
        }));
        
        const gatewayPayload = {
            phone: formatPhoneNumber(attendeeData.phoneNumber || ''),
            email: attendeeData.email || 'guest@example.com',
            cbs: organizer.cbsAccount,
            items: itemsForGateway,
        };

        const gatewayResponse = await fetch(`${paymentGatewayUrl}/api/payment/create-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Api-Key': apiKey,
            },
            body: JSON.stringify(gatewayPayload),
        });

        const gatewayResult = await gatewayResponse.json();

        if (gatewayResult.ResponseCode !== '0' || !gatewayResult.Data?.URL || !gatewayResult.Data?.NA) {
            console.error('Payment Gateway API Error:', gatewayResult);
            const errorMessage = gatewayResult.ResponseDescription || 'Error communicating with payment gateway.';
            return NextResponse.json({ error: errorMessage }, { status: 500 });
        }
        
        // Update the pending order with the session ID from the gateway
        await prisma.pendingOrder.update({
            where: { id: pendingOrder.id },
            data: {
                arifpaySessionId: gatewayResult.Data.NA,
            }
        });

        return NextResponse.json({ paymentUrl: gatewayResult.Data.URL });

    } catch (error: any) {
        console.error('Payment initiation failed:', error);
        return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }
}
