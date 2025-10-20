
'use server';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
    if (req.method !== 'POST') {
        return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
    }
    let requestBody;
    try {
        requestBody = await req.json();
    } catch (e) {
        console.error("Callback Error: Invalid JSON in request body.", e);
        return NextResponse.json({ message: "Error Occurred: Invalid JSON" }, { status: 400 });
    }

    try {
        const {
            transactionId,
            // You can use these other fields for logging or cross-referencing
            paidAmount,
            paidByNumber,
            txnRef,
            transactionTime,
            accountNo,
            token,
            Signature: receivedSignature
        } = requestBody;

        if (!transactionId) {
            console.error("No transactionId in NIB notification.");
            return NextResponse.json({ error: 'Transaction ID is missing' }, { status: 400 });
        }
        
        const order = await prisma.pendingOrder.findFirst({
            where: { transactionId: transactionId },
        });

        if (!order) {
            console.error(`Order not found for transaction: ${transactionId}`);
            // Return 200 even if order not found to prevent gateway from retrying.
            // The error is on our side or it's a test webhook.
            return NextResponse.json({ message: 'Order not found, but acknowledged.' }, { status: 200 });
        }
        
        if (order.status === 'COMPLETED') {
             console.log(`Order for transaction ${transactionId} already handled.`);
             return NextResponse.json({ message: 'Already handled' }, { status: 200 });
        }

        // The callback signifies a successful transaction.
        const { name, phoneNumber, userId, quantity } = order.attendeeData as { name: string, phoneNumber?: string, userId?: string, quantity: number };

        const createdAttendees = await prisma.$transaction(async (tx) => {
            
            if (!order.ticketTypeId) {
                throw new Error("Pending order is missing ticketTypeId.");
            }

            const ticketType = await tx.ticketType.findUnique({ where: { id: order.ticketTypeId }});
            if (!ticketType) {
                throw new Error(`TicketType with ID ${order.ticketTypeId} not found.`);
            }
            
            const attendeesToCreate = [];
            const purchaseQuantity = quantity || 1; 

            for (let i = 0; i < purchaseQuantity; i++) {
                 attendeesToCreate.push({
                    name: name,
                    phoneNumber: phoneNumber,
                    eventId: order.eventId,
                    ticketTypeId: ticketType.id,
                    userId: userId,
                    checkedIn: false,
                });
            }

            if(attendeesToCreate.length === 0) {
                throw new Error("No valid tickets found to create attendees.");
            }

            await tx.attendee.createMany({
                data: attendeesToCreate,
            });
            
            await tx.ticketType.update({
                where: { id: ticketType.id },
                data: { sold: { increment: purchaseQuantity } },
            });

            const lastCreated = await tx.attendee.findFirst({
                where: { eventId: order.eventId, name, phoneNumber, userId },
                orderBy: { createdAt: 'desc' }
            });

            if (order.promoCode) {
                const promo = await tx.promoCode.findFirst({ where: { code: order.promoCode, eventId: order.eventId } });
                if (promo) {
                    await tx.promoCode.update({
                        where: { id: promo.id },
                        data: { uses: { increment: purchaseQuantity } },
                    });
                }
            }
            
            await tx.pendingOrder.update({
                where: { id: order.id },
                data: { 
                    status: 'COMPLETED',
                    attendeeId: lastCreated?.id
                },
            });

            return lastCreated;
        });

        revalidatePath(`/events/${order.eventId}`);
        revalidatePath('/');
        revalidatePath('/tickets');

        console.log(`Successfully processed payment for transaction ${transactionId}. Attendee ID for confirmation: ${createdAttendees?.id}`);
        
        return NextResponse.json({ message: 'Payment confirmed and updated.' }, { status: 200 });

    } catch (error: any) {
        console.error('Webhook processing error:', error);
        return NextResponse.json({ message: 'Internal server error processing webhook.' }, { status: 400 }); // Return 400 as per instruction for failure
    }
}
