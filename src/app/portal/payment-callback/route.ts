

'use server';

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { randomUUID } from "crypto";
import { normalizePhoneNumber } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {                                       
    const rawBody = await req.text();
    let parsedBody: any = null;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      // Body is not JSON
    }

    const { searchParams } = new URL(req.url);
    const transactionIdFromQuery = searchParams.get("transactionId");
    
    // NIB uses 'txnRef' for OUR transaction ID in the callback body.
    const transactionIdFromBody = parsedBody?.txnRef;

    const transactionId = transactionIdFromQuery || transactionIdFromBody;

    if (!transactionId) {
      console.error("[NIB NOTIFY] Error: Transaction reference (txnRef or transactionId) not found in callback body or query.", { body: rawBody, query: Object.fromEntries(searchParams) });
      // Acknowledge receipt to NIB to prevent retries, but indicate an issue.
      return NextResponse.json({ message: "OK" }, { status: 200 });
    }
    
    console.log(`[NIB NOTIFY] Found transactionId: ${transactionId}`);
    
    // Find the corresponding EventPayment and its PendingOrder
    const payment = await prisma.eventPayment.findUnique({
        where: { transactionId },
        include: { pendingOrder: true },
    });

    if (!payment) {
        console.error(`[NIB NOTIFY] Error: No EventPayment found for transactionId: ${transactionId}`);
        return NextResponse.json({ message: "OK" }, { status: 200 });
    }
    
    if (payment.status === 'COMPLETED') {
        console.log(`[NIB NOTIFY] Info: Transaction ${transactionId} already completed.`);
        return NextResponse.json({ message: "OK" }, { status: 200 });
    }

    const order = payment.pendingOrder;
    if (!order) {
        console.error(`[NIB NOTIFY] Error: No PendingOrder associated with EventPayment ID: ${payment.id}`);
        return NextResponse.json({ message: "OK" }, { status: 200 });
    }
    
    // Use paidByNumber from NIB if available and normalize it.
    const paidByNumberRaw = parsedBody?.paidByNumber;
    console.log(`[NIB NOTIFY] paidByNumber (raw): ${paidByNumberRaw}`);
    const paidByNumberNormalized = paidByNumberRaw ? normalizePhoneNumber(paidByNumberRaw) : null;
    
    const orderAttendeeData = order.attendeeData as {
      name: string;
      phone: string;
      userId?: string;
      quantity: number;
    };
    const orderPhoneNormalized = normalizePhoneNumber(orderAttendeeData.phone);
    
    if (paidByNumberNormalized && paidByNumberNormalized === orderPhoneNormalized) {
        console.log(`[NIB NOTIFY] paidByNumber matches pending order phone for transaction: ${transactionId}`);
    } else {
        console.warn(`[NIB NOTIFY] Warning: Phone number mismatch for transaction ${transactionId}. Order Phone: ${orderPhoneNormalized}, Paid By: ${paidByNumberNormalized}. Proceeding with order phone.`);
    }

    // Now, perform the atomic transaction to create tickets and finalize the order.
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update payment status
      await tx.eventPayment.update({
        where: { id: payment.id },
        data: { status: "COMPLETED", paymentDate: new Date() },
      });

      // 2. Create Attendee(s) (the tickets)
      const totalQuantity = orderAttendeeData.quantity || 1;
      if (!order.ticketTypeId) throw new Error("PendingOrder is missing ticketTypeId");

      const createdAttendees = [];
      for (let i = 0; i < totalQuantity; i++) {
        const attendee = await tx.attendee.create({
          data: {
            name: orderAttendeeData.name,
            phoneNumber: orderPhoneNormalized,
            userId: orderAttendeeData.userId,
            eventId: order.eventId,
            ticketTypeId: order.ticketTypeId,
            checkedIn: false,
            qrCode: randomUUID(),
          },
        });
        createdAttendees.push(attendee);
      }
      
      // 3. Update ticket sold count
      await tx.ticketType.update({
        where: { id: order.ticketTypeId },
        data: { sold: { increment: totalQuantity } },
      });

      // 4. Update promo code usage if applicable
      if (order.promoCode) {
        const promo = await tx.promoCode.findFirst({
          where: { code: order.promoCode, eventId: order.eventId },
        });
        if (promo) {
          await tx.promoCode.update({
            where: { id: promo.id },
            data: { uses: { increment: totalQuantity } },
          });
        }
      }

      // 5. Finalize the PendingOrder, storing the ID of the primary attendee
      const primaryAttendeeId = createdAttendees[0]?.id;
      if (!primaryAttendeeId) throw new Error("Failed to create any attendee records.");

      const updatedOrder = await tx.pendingOrder.update({
        where: { id: order.id },
        data: {
          status: "COMPLETED",
          attendeeId: primaryAttendeeId,
        },
      });

      return { order: updatedOrder, attendees: createdAttendees };
    });

    console.log(`[NIB NOTIFY] Successfully processed transaction ${transactionId}, created ${result.attendees.length} tickets.`);

    return NextResponse.json({ message: "OK" }, { status: 200 });

  } catch (err: any) {
    console.error("[NIB NOTIFY] Fatal error processing callback:", err);
    // Still return 200 OK to NIB, but log the internal error for debugging.
    return NextResponse.json({ message: "Internal Server Error" }, { status: 200 });
  }
}
