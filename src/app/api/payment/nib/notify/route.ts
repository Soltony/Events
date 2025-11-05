
'use server';

import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
  let requestBody;
  try {
    requestBody = await request.json();
  } catch (e) {
    console.error("Callback Error: Invalid JSON in request body.", e);
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const headerList = await headers();
  const authHeader = headerList.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error("Authorization header is missing or malformed.");
    return NextResponse.json({ message: 'Authorization header is required.' }, { status: 401 });
  }

  const tokenFromHeader = authHeader.substring(7);

  const {
    paidAmount,
    txnRef,
    transactionId,
    token: tokenFromBody,
  } = requestBody;

  if (tokenFromHeader !== tokenFromBody) {
    console.error("Token mismatch between header and body.");
    return NextResponse.json({ message: "Token validation failed." }, { status: 401 });
  }

  try {
    const eventPayment = await prisma.eventPayment.findFirst({
      where: { transactionId: txnRef },
      include: { pendingOrder: true }
    });

    if (!eventPayment || !eventPayment.pendingOrder) {
      console.error(`Order not found for NIB transaction reference: ${txnRef}`);
      return NextResponse.json({ message: 'Order not found, but acknowledged.' }, { status: 200 });
    }

    if (eventPayment.status === 'COMPLETED' || eventPayment.pendingOrder.status === 'COMPLETED') {
      console.log(`Order for transaction ${txnRef} already handled.`);
      return NextResponse.json({ message: 'Already handled' }, { status: 200 });
    }

    // Use a transaction to ensure atomicity
    const createdAttendee = await prisma.$transaction(async (tx) => {
      // 1. Get attendee data from pending order
      const attendeeData = eventPayment.pendingOrder.attendeeData as { name: string, phone: string, userId?: string, tickets: any[] };
      const { name, phone, userId, tickets } = attendeeData;

      if (!tickets || tickets.length === 0) {
        throw new Error('No ticket information found in pending order.');
      }
      
      let lastAttendee = null;

      // 2. Create Attendee record(s)
      for (const ticketInfo of tickets) {
        const ticketTypeId = ticketInfo.id;
        const quantity = ticketInfo.quantity || 1;

        const ticketType = await tx.ticketType.findUnique({ where: { id: ticketTypeId } });
        if (!ticketType) {
          throw new Error(`Ticket type with ID ${ticketTypeId} not found.`);
        }
        if ((ticketType.total - ticketType.sold) < quantity) {
          throw new Error(`Not enough tickets available for "${ticketType.name}".`);
        }

        const attendeesToCreate = Array.from({ length: quantity }).map(() => ({
          name,
          phoneNumber: phone,
          userId: userId,
          eventId: eventPayment.eventId,
          ticketTypeId: ticketTypeId,
          checkedIn: false,
        }));

        await tx.attendee.createMany({ data: attendeesToCreate });

        // Get the last created attendee for this batch
        lastAttendee = await tx.attendee.findFirst({
            where: { eventId: eventPayment.eventId, name, phoneNumber: phone, userId, ticketTypeId: ticketTypeId },
            orderBy: { createdAt: 'desc' }
        });

        // 3. Update ticket stock
        await tx.ticketType.update({
          where: { id: ticketTypeId },
          data: { sold: { increment: quantity } },
        });
      }
      
      // 4. Update Promo Code uses if applicable
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

      // 5. Update PendingOrder status and link to the created attendee
      await tx.pendingOrder.update({
        where: { id: eventPayment.pendingOrderId },
        data: { status: 'COMPLETED', attendeeId: lastAttendee?.id },
      });

      // 6. Update EventPayment status
      await tx.eventPayment.update({
        where: { id: eventPayment.id },
        data: {
          status: 'COMPLETED',
          amount: paidAmount,
          paymentDate: new Date(),
          reference: transactionId, // NIB's own transactionId
        },
      });
      
      return lastAttendee;
    });

    // Revalidate paths to show updated data
    revalidatePath(`/events/${eventPayment.eventId}`);
    revalidatePath('/');
    revalidatePath('/tickets');
    revalidatePath(`/payment/success?transaction_id=${eventPayment.pendingOrder.transactionId}`);

    console.log(`Successfully processed payment for transaction ${txnRef}.`);

    return NextResponse.json({ message: 'Payment confirmed and updated.', attendeeId: createdAttendee?.id }, { status: 200 });

  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ message: 'Internal server error processing webhook.', detail: error.message }, { status: 500 });
  }
}
