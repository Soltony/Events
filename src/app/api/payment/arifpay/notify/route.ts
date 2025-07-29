
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
    try {
        const payload = await req.json();
        console.log('ArifPay Notification Payload:', payload);
        
        const { sessionId, transactionStatus } = payload.data;

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
            // Use a transaction to ensure atomicity
            const newAttendee = await prisma.$transaction(async (tx) => {
                const { name, email, userId } = order.attendeeData as { name: string, email?: string, userId?: string };

                // 1. Create the attendee record
                const createdAttendee = await tx.attendee.create({
                    data: {
                        name: name,
                        email: email,
                        eventId: order.eventId,
                        ticketTypeId: order.ticketTypeId,
                        userId: userId,
                        checkedIn: false,
                    },
                });

                // 2. Update the ticket type's sold count
                await tx.ticketType.update({
                    where: { id: order.ticketTypeId },
                    data: { sold: { increment: 1 } },
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
                
                // 4. Mark the pending order as completed and link to attendee
                await tx.pendingOrder.update({
                    where: { id: order.id },
                    data: { 
                        status: 'COMPLETED',
                        attendeeId: createdAttendee.id
                    },
                });

                return createdAttendee;
            });

            // Revalidate paths to update caches
            revalidatePath(`/events/${order.eventId}`);
            revalidatePath('/');
            revalidatePath('/tickets');

            console.log(`Successfully processed payment for session ${sessionId}. Attendee ID: ${newAttendee.id}`);
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
