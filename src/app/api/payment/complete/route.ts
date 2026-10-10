import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { notifyGiftPurchase } from '@/lib/gift-notifications';
import { auditRequestContext, logAudit } from '@/lib/audit';
import { fulfilPendingOrder, OrderAlreadyCompletedError, OrderError, pricePendingOrder } from '@/lib/orders';
import { withApiErrorHandling } from '@/lib/api-handler';

/**
 * Completes a FREE order without the payment gateway. Paid orders can only be completed
 * by the verified NIB payment callback — the total is recomputed server-side here and any
 * order that costs more than zero is refused.
 */
export const POST = withApiErrorHandling(async function POST(req: NextRequest) {
    let transactionId: string | null = null;
    try {
        let body: any;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
        }
        const id = body?.id;
        if (typeof id !== 'string' || !id) {
            return NextResponse.json({
                error: 'Invalid request',
                detail: 'Body must include the transaction ID as "id".'
            }, { status: 400 });
        }
        transactionId = id;

        const order = await prisma.pendingOrder.findUnique({
            where: { transactionId: id },
            include: { event: { select: { name: true, startDate: true, endDate: true, status: true } } },
        });

        if (!order) {
            return NextResponse.json({
                error: 'Order not found',
                detail: 'No pending order matches the provided transaction/session ID.'
            }, { status: 404 });
        }

        if (order.status === 'COMPLETED') {
            return NextResponse.json({ message: 'Already completed', attendeeId: order.attendeeId ?? null }, { status: 200 });
        }
        const eventEndTime = order.event.endDate ? new Date(order.event.endDate) : new Date(order.event.startDate);
        if (order.event.status !== 'APPROVED' || eventEndTime.getTime() < Date.now()) {
            return NextResponse.json(
              { error: 'Ticket sales closed', detail: 'This event is no longer available for purchase.' },
              { status: 400 }
            );
        }

        const { totalCents } = await pricePendingOrder(prisma, order);
        if (totalCents !== 0) {
            await logAudit({
                action: 'payment.free_completion.rejected',
                severity: 'critical',
                actorType: 'anonymous',
                targetType: 'PendingOrder',
                targetId: String(order.id),
                ...auditRequestContext(req),
                detail: { reason: 'order_requires_payment', totalCents },
            });
            return NextResponse.json(
              { error: 'Payment required', detail: 'This order must be paid through the payment gateway.' },
              { status: 402 }
            );
        }

        const result = await prisma.$transaction((tx) =>
            fulfilPendingOrder(tx, order, { enforcePerPhoneLimit: true })
        );

        revalidatePath(`/events/${order.eventId}`);
        revalidatePath('/');
        revalidatePath('/tickets');

        if (result.data.isGift && result.phoneNumber) {
            notifyGiftPurchase({
                recipientPhone: result.phoneNumber,
                buyerId: result.data.purchasedById ?? null,
                buyerName: result.data.purchasedByName ?? null,
                eventName: order.event.name,
                ticketTypeName: result.ticketTypeName ?? 'ticket',
                quantity: result.quantity,
            }).catch((err) => console.error('Gift notification error:', err));
        }

        return NextResponse.json({ message: 'Completed', attendeeId: result.attendeeId });
    } catch (e) {
        if (e instanceof OrderAlreadyCompletedError) {
            const order = transactionId
                ? await prisma.pendingOrder.findUnique({ where: { transactionId }, select: { attendeeId: true } }).catch(() => null)
                : null;
            return NextResponse.json({ message: 'Already completed', attendeeId: order?.attendeeId ?? null }, { status: 200 });
        }
        if (e instanceof OrderError) {
            return NextResponse.json({ error: 'Failed to complete order', detail: e.message }, { status: e.status });
        }
        console.error('Complete payment error', e);
        return NextResponse.json(
          {
            error: 'Failed to complete order',
            detail: 'An error occurred while issuing ticket(s) and finalizing the order.',
          },
          { status: 500 }
        );
    }
});
