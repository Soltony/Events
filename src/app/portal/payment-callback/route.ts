import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { notifyGiftPurchase } from '@/lib/gift-notifications';
import { auditRequestContext, logAudit } from '@/lib/audit';
import { fulfilPendingOrder, OrderAlreadyCompletedError, OrderError, toCents } from '@/lib/orders';
import { withApiErrorHandling } from '@/lib/api-handler';

/**
 * NIB payment gateway callback.
 *
 * A callback is only honoured when ALL of the following hold:
 *  - the bearer token in the Authorization header equals the token in the body;
 *  - that token equals the payment token NIB issued for this transaction at initiation
 *    (stored server-side in EventPayment.sessionId) — constant-time comparison;
 *  - `txnRef` is our server-generated payment reference, which is only ever sent to NIB;
 *  - the paid amount equals the server-computed amount recorded for this payment;
 *  - the payment has not already been completed (claimed atomically, so replays and
 *    concurrent deliveries cannot issue tickets twice).
 */

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function reject(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export const POST = withApiErrorHandling(async function POST(request: NextRequest) {
  const ctx = auditRequestContext(request);
  const auditRejection = (reason: string, detail: Record<string, unknown> = {}) =>
    logAudit({
      action: 'payment.callback.rejected',
      severity: 'critical',
      actorType: 'anonymous',
      targetType: 'EventPayment',
      targetId: typeof detail.txnRef === 'string' ? detail.txnRef : null,
      ...ctx,
      detail: { reason, ...detail },
    });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return reject('Invalid JSON', 400);
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return reject('Authorization header is required.', 401);
  }
  const tokenFromHeader = authHeader.substring(7);

  const { paidAmount, txnRef, transactionId: gatewayTransactionId, token: tokenFromBody } = body ?? {};
  if (
    typeof txnRef !== 'string' || !txnRef ||
    typeof tokenFromBody !== 'string' || !tokenFromBody ||
    (typeof paidAmount !== 'number' && typeof paidAmount !== 'string')
  ) {
    return reject('Invalid callback payload.', 400);
  }

  if (!safeEqual(tokenFromHeader, tokenFromBody)) {
    await auditRejection('header_body_token_mismatch', { txnRef });
    return reject('Token validation failed.', 401);
  }

  try {
    const eventPayment = await prisma.eventPayment.findUnique({
      where: { transactionId: txnRef },
      include: { pendingOrder: true },
    });

    if (!eventPayment || eventPayment.method !== 'GATEWAY') {
      await auditRejection('unknown_transaction', { txnRef });
      return reject('Token validation failed.', 401);
    }

    // The token must be the one NIB issued for THIS payment at initiation.
    if (!eventPayment.sessionId || !safeEqual(tokenFromBody, eventPayment.sessionId)) {
      await auditRejection('stored_token_mismatch', { txnRef, eventPaymentId: eventPayment.id });
      return reject('Token validation failed.', 401);
    }

    let paidCents: number;
    try {
      paidCents = toCents(paidAmount);
    } catch {
      return reject('Invalid paid amount.', 400);
    }
    if (paidCents !== toCents(eventPayment.amount)) {
      await auditRejection('amount_mismatch', {
        txnRef,
        eventPaymentId: eventPayment.id,
        expected: eventPayment.amount.toString(),
        received: String(paidAmount),
      });
      return reject('Paid amount does not match the order total.', 400);
    }

    if (eventPayment.status === 'COMPLETED' || eventPayment.pendingOrder.status === 'COMPLETED') {
      return NextResponse.json({ message: 'Already handled' }, { status: 200 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.eventPayment.updateMany({
        where: { id: eventPayment.id, status: { not: 'COMPLETED' } },
        data: {
          status: 'COMPLETED',
          paymentDate: new Date(),
          reference: typeof gatewayTransactionId === 'string' ? gatewayTransactionId : null,
        },
      });
      if (claimed.count === 0) throw new OrderAlreadyCompletedError();

      // Per-phone limits were enforced when the order was created; the buyer has paid now.
      return fulfilPendingOrder(tx, eventPayment.pendingOrder, { enforcePerPhoneLimit: false });
    });

    revalidatePath(`/events/${eventPayment.eventId}`);
    revalidatePath('/');
    revalidatePath('/tickets');

    await logAudit({
      action: 'payment.callback.completed',
      actorType: 'system',
      targetType: 'EventPayment',
      targetId: eventPayment.id,
      ...ctx,
      detail: { pendingOrderId: eventPayment.pendingOrderId, amount: eventPayment.amount.toString() },
    });

    if (result.data.isGift && result.phoneNumber) {
      const event = await prisma.event.findUnique({ where: { id: eventPayment.eventId }, select: { name: true } });
      notifyGiftPurchase({
        recipientPhone: result.phoneNumber,
        buyerId: result.data.purchasedById ?? null,
        buyerName: result.data.purchasedByName ?? null,
        eventName: event?.name ?? 'the event',
        ticketTypeName: result.ticketTypeName ?? 'ticket',
        quantity: result.quantity,
      }).catch((err) => console.error('[NIB CALLBACK] Gift notification error:', err));
    }

    return NextResponse.json({ message: 'Payment confirmed and updated.', attendeeId: result.attendeeId }, { status: 200 });
  } catch (error) {
    if (error instanceof OrderAlreadyCompletedError) {
      return NextResponse.json({ message: 'Already handled' }, { status: 200 });
    }
    if (error instanceof OrderError) {
      console.error(`[NIB CALLBACK] Could not fulfil paid order for txnRef ${txnRef}: ${error.message}`);
      return reject('Payment received but the order could not be fulfilled.', error.status);
    }
    console.error(`[NIB CALLBACK] Processing error for txnRef ${txnRef}:`, error);
    return reject('Internal server error processing webhook.', 500);
  }
});
