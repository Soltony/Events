import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { id } = body as { id?: string };
        if (!id) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        }

        const order = await prisma.pendingOrder.findFirst({
            where: {
                OR: [
                    { transactionId: id },
                    { arifpaySessionId: id },
                ]
            }
        });

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (order.status === 'COMPLETED') {
            return NextResponse.json({ message: 'Already completed' }, { status: 200 });
        }

        // Simulate success by calling the notify logic via DB operations
        const { name, phoneNumber, userId, quantity } = order.attendeeData as { name: string, phoneNumber?: string, userId?: string, quantity: number };

        const createdAttendee = await prisma.$transaction(async (tx) => {
            if (!order.ticketTypeId) {
                throw new Error('Missing ticketTypeId');
            }
            const ticketType = await tx.ticketType.findUnique({ where: { id: order.ticketTypeId } });
            if (!ticketType) {
                throw new Error('Ticket type not found');
            }
            const qty = quantity || 1;
            const attendees = Array.from({ length: qty }).map(() => ({
                name,
                phoneNumber,
                eventId: order.eventId,
                ticketTypeId: ticketType.id,
                userId,
                checkedIn: false,
            }));
            await tx.attendee.createMany({ data: attendees });
            await tx.ticketType.update({ where: { id: ticketType.id }, data: { sold: { increment: qty } } });
            const last = await tx.attendee.findFirst({
                where: { eventId: order.eventId, name, phoneNumber, userId },
                orderBy: { createdAt: 'desc' }
            });
            if (order.promoCode) {
                const promo = await tx.promoCode.findFirst({ where: { code: order.promoCode, eventId: order.eventId } });
                if (promo) {
                    await tx.promoCode.update({ where: { id: promo.id }, data: { uses: { increment: qty } } });
                }
            }
            await tx.pendingOrder.update({ where: { id: order.id }, data: { status: 'COMPLETED', attendeeId: last?.id } });
            return last;
        });

        revalidatePath(`/events/${order.eventId}`);
        revalidatePath('/');
        revalidatePath('/tickets');

        return NextResponse.json({ message: 'Completed', attendeeId: createdAttendee?.id });
    } catch (e: any) {
        console.error('Complete payment error', e);
        return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
    }
}


