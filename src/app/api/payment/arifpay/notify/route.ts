

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
    try {
        const payload = await req.json();
        console.log('ArifPay Notification Payload:', payload);
        
        const { sessionId, transactionStatus, items } = payload.data;

        if (!sessionId) {
            console.error("No sessionId in ArifPay notification.");
            return NextResponse.json({ error: 'Session ID is missing' }, { status: 400 });
        }
        
        const order = await prisma.pendingOrder.findFirst({
            where: { arifpaySessionId: sessionId },
        });

        if (!order) {
            console.error(`Order not found for ArifPay session: ${sessionId}`);
            return NextResponse.json({ message: 'Order not found' }, { status: 404 });
        }
        
        // Idempotency check: if order is already completed, do nothing.
        if (order.status === 'COMPLETED') {
             console.log(`Order for session ${sessionId} already handled.`);
             return NextResponse.json({ message: 'Already handled' }, { status: 200 });
        }

        if (transactionStatus === 'SUCCESS') {
            const { name, email, userId } = order.attendeeData as { name: string, email?: string, userId?: string };

            const createdAttendees = await prisma.$transaction(async (tx) => {
                const attendeesToCreate = [];

                for (const item of items) {
                    const ticketType = await tx.ticketType.findFirst({
                         where: { name: item.name, eventId: order.eventId }
                    });

                    if (!ticketType) {
                         console.warn(`Ticket type "${item.name}" not found for event ${order.eventId}. Skipping.`);
                         continue;
                    }

                    for (let i = 0; i < item.quantity; i++) {
                        attendeesToCreate.push({
                            name: name,
                            email: email,
                            eventId: order.eventId,
                            ticketTypeId: ticketType.id,
                            userId: userId,
                            checkedIn: false,
                        });
                    }
                     // 2. Update the ticket type's sold count
                    await tx.ticketType.update({
                        where: { id: ticketType.id },
                        data: { sold: { increment: item.quantity } },
                    });
                }
                
                if(attendeesToCreate.length === 0) {
                    throw new Error("No valid tickets found to create attendees.");
                }

                // 1. Create all attendee records
                await tx.attendee.createMany({
                    data: attendeesToCreate,
                });
                
                // This is a simplification; we're just getting the last one for the pending order link.
                // In a full implementation, you might create a parent Order record.
                const lastCreated = await tx.attendee.findFirst({
                    where: { eventId: order.eventId, name, email, userId },
                    orderBy: { createdAt: 'desc' }
                });

                // 3. Update the promo code usage if applicable
                if (order.promoCode) {
                    const promo = await tx.promoCode.findFirst({ where: { code: order.promoCode, eventId: order.eventId } });
                    if (promo) {
                        await tx.promoCode.update({
                            where: { id: promo.id },
                            data: { uses: { increment: 1 } },
                        });
                    }
                }
                
                // 4. Mark the pending order as completed and link to an attendee (for confirmation page)
                await tx.pendingOrder.update({
                    where: { id: order.id },
                    data: { 
                        status: 'COMPLETED',
                        attendeeId: lastCreated?.id
                    },
                });

                return lastCreated;
            });

            // Revalidate paths to update caches
            revalidatePath(`/events/${order.eventId}`);
            revalidatePath('/');
            revalidatePath('/tickets');

            console.log(`Successfully processed payment for session ${sessionId}. Attendee ID for confirmation: ${createdAttendees?.id}`);
        } else {
            // Handle failed or cancelled payment
            await prisma.pendingOrder.update({
                where: { id: order.id },
                data: { status: 'FAILED' },
            });
            console.log(`Payment failed or was cancelled for session ${sessionId}.`);
        }

        return NextResponse.json({ message: 'Notification handled successfully' }, { status: 200 });

    } catch (error: any) {
        console.error('Webhook processing error:', error);
        return NextResponse.json({ error: 'Internal server error processing webhook.' }, { status: 500 });
    }
}
