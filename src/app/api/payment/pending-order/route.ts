
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { eventId, tickets, promoCode, attendeeDetails, transactionId } = body;

        if (!eventId || !tickets?.length || !attendeeDetails || !transactionId) {
            return NextResponse.json({
                error: 'Invalid request payload',
                detail: 'Required fields: transactionId, eventId, tickets[], attendeeDetails.'
            }, { status: 400 });
        }

        const totalQuantity = (tickets as Array<{ quantity: number }>).reduce((sum: number, t) => sum + Number(t.quantity), 0);
        
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
                arifpaySessionId: transactionId, // Using this field for consistency
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
