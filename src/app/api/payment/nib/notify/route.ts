
'use server';

import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  let requestBody;
  try {
    requestBody = await request.json();
    console.log('[NIB NOTIFY] Received callback with body:', JSON.stringify(requestBody, null, 2));
  } catch (e) {
    console.error("[NIB NOTIFY] Callback Error: Invalid JSON in request body.", e);
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  // Step 5: Validate the token from the Authorization header
  const headerList = headers();
  const authHeader = headerList.get('Authorization');
  console.log('[NIB NOTIFY] Received Authorization Header:', authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error("[NIB NOTIFY] Authorization header is missing or malformed.");
    return NextResponse.json({ message: 'Authorization header is required.' }, { status: 401 });
  }
  const tokenFromHeader = authHeader.substring(7);

  const {
    paidAmount,
    txnRef, // This is our original transactionId for the payment attempt
    transactionId, // This is NIB's transactionId
    token: tokenFromBody,
  } = requestBody;
  
  if (!txnRef) {
      console.error("[NIB NOTIFY] 'txnRef' is missing from the callback body.");
      return NextResponse.json({ message: "Transaction reference (txnRef) is required." }, { status: 400 });
  }

  // Per NIB docs, the token in the body should be validated against the header token
  if (tokenFromHeader !== tokenFromBody) {
    console.error("[NIB NOTIFY] Token mismatch between header and body.");
    return NextResponse.json({ message: "Token validation failed." }, { status: 401 });
  }

  try {
    // Find our payment record using the reference we sent
    const eventPayment = await prisma.eventPayment.findFirst({
      where: { transactionId: txnRef }, 
      include: { pendingOrder: true }
    });

    if (!eventPayment || !eventPayment.pendingOrder) {
      console.error(`[NIB NOTIFY] Order not found for transaction reference (txnRef): ${txnRef}`);
      return NextResponse.json({ message: 'Order not found, but acknowledged.' }, { status: 200 });
    }

    if (eventPayment.status === 'COMPLETED' || eventPayment.pendingOrder.status === 'COMPLETED') {
      console.log(`[NIB NOTIFY] Order for transaction ${txnRef} already handled.`);
      return NextResponse.json({ message: 'Already handled' }, { status: 200 });
    }

    await prisma.$transaction(async (tx) => {
      const attendeeData = eventPayment.pendingOrder.attendeeData as { name: string, phoneNumber: string, userId?: string, tickets: any[] };
      if (!attendeeData || typeof attendeeData !== 'object' || !attendeeData.tickets) {
          throw new Error('attendeeData in PendingOrder is malformed or missing.');
      }
      const { name, phoneNumber, userId, tickets } = attendeeData;

      let firstAttendeeId: number | null = null;
      for (const ticketInfo of tickets) {
        const ticketTypeId = ticketInfo.id;
        const quantity = ticketInfo.quantity || 1;

        const ticketType = await tx.ticketType.findUnique({ where: { id: ticketTypeId } });
        if (!ticketType) throw new Error(`Ticket type with ID ${ticketTypeId} not found.`);
        if ((ticketType.total - ticketType.sold) < quantity) throw new Error(`Not enough tickets available for "${ticketType.name}".`);

        // Create an attendee record for each individual ticket
        for (let i = 0; i < quantity; i++) {
          const newAttendee = await tx.attendee.create({
              data: {
                  name,
                  phoneNumber,
                  userId: userId,
                  eventId: eventPayment.eventId,
                  ticketTypeId: ticketTypeId,
                  checkedIn: false,
                  qrCode: crypto.randomUUID(), // This is the unique ID for scanning
              }
          });
          if (!firstAttendeeId) {
              firstAttendeeId = newAttendee.id;
          }
        }

        await tx.ticketType.update({
          where: { id: ticketTypeId },
          data: { sold: { increment: quantity } },
        });
      }
      
      if (eventPayment.pendingOrder.promoCode) {
        const promo = await tx.promoCode.findFirst({ where: { code: eventPayment.pendingOrder.promoCode, eventId: eventPayment.eventId } });
        if (promo) {
          const totalQuantity = tickets.reduce((sum, t) => sum + (t.quantity || 1), 0);
          await tx.promoCode.update({
            where: { id: promo.id },
            data: { uses: { increment: totalQuantity } },
          });
        }
      }

      await tx.pendingOrder.update({
        where: { id: eventPayment.pendingOrderId },
        data: { 
            status: 'COMPLETED',
            attendeeId: firstAttendeeId // Link to the first created attendee for reference
        },
      });

      await tx.eventPayment.update({
        where: { id: eventPayment.id },
        data: {
          status: 'COMPLETED',
          amount: paidAmount,
          paymentDate: new Date(),
          reference: transactionId,
        },
      });
      
      console.log(`[NIB NOTIFY] Payment completed for Transaction ID: ${txnRef}`);
    });

    revalidatePath(`/events/${eventPayment.eventId}`);
    revalidatePath('/');
    revalidatePath('/tickets');
    revalidatePath(`/payment/success?transaction_id=${eventPayment.pendingOrder.transactionId}`);

    console.log(`[NIB NOTIFY] Successfully processed payment for transaction ${txnRef}.`);
    return NextResponse.json({ message: 'Payment confirmed and updated.' }, { status: 200 });

  } catch (error: any) {
    console.error('[NIB NOTIFY] Webhook processing error:', error);
    if (txnRef) {
        try {
            const payment = await prisma.eventPayment.findFirst({ where: { transactionId: txnRef }});
            if (payment) {
                await prisma.pendingOrder.update({
                    where: { id: payment.pendingOrderId },
                    data: { status: 'FAILED' }
                });
            }
        } catch(e) {
            console.error(`[NIB NOTIFY] Failed to mark order as FAILED for txnRef ${txnRef}`, e);
        }
    }
    return NextResponse.json({ message: 'Internal server error processing webhook.', detail: error.message }, { status: 500 });
  }
}
