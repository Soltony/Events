

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { normalizePhoneNumber } from '@/lib/utils';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { eventId, tickets, promoCode, attendeeDetails } = body;

        if (!eventId || !tickets?.length || !attendeeDetails) {
            return NextResponse.json({
                error: 'Invalid request payload',
                detail: 'Required fields: eventId, tickets[], attendeeDetails.'
            }, { status: 400 });
        }

        const totalQuantity = (tickets as Array<{ quantity: number }>).reduce((sum: number, t) => sum + Number(t.quantity), 0);
        
        // This transactionId is our internal reference for the entire purchase flow.
        const transactionId = randomUUID();

        const normalizedPhone = normalizePhoneNumber(attendeeDetails.phone);

        const pendingOrder = await prisma.pendingOrder.create({
            data: {
                transactionId: transactionId,
                eventId,
                ticketTypeId: tickets[0].id, // Store primary ticket type
                attendeeData: {
                    name: attendeeDetails.name,
                    phoneNumber: normalizedPhone,
                    userId: attendeeDetails.userId,
                    quantity: totalQuantity,
                    tickets: tickets, // Store all selected ticket details
                },
                promoCode,
                status: 'PENDING',
                arifpaySessionId: transactionId, // Use this field to store our internal transaction ID
            },
        });

        return NextResponse.json({ success: true, transactionId: pendingOrder.transactionId });
    } catch (error: any) {
        console.error(`Pending order creation failed:`, error.message);
        return NextResponse.json({
            error: 'Unexpected server error',
            detail: `An unknown error occurred while creating the pending order.`
        }, { status: 500 });
    }
}
