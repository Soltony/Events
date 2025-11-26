

'use server';

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { randomUUID } from "crypto";

function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  // Normalize Ethiopian-style numbers: 2519xxxxxxxx or 09xxxxxxxx -> 9xxxxxxxx
  if (digits.startsWith("251") && digits.length >= 11) {
    return digits.slice(-9);
  }
  if (digits.startsWith("0") && digits.length >= 10) {
    return digits.slice(-9);
  }
  return digits;
}

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
    console.log("[NIB NOTIFY] Full URL:", req.url);
    console.log("[NIB NOTIFY] Query params:", Object.fromEntries(searchParams));

    // 5. Get our internal transactionId and the paidByNumber (payer phone).
    //
    // For NIB, the field `txnRef` in the callback body contains the same UUID
    // we originally sent as `transactionId` when initiating the payment.
    // The field `transactionId` in the callback body is the BANK'S reference
    // (e.g. "FT252742WQR6"), which does NOT match our EventPayment.transactionId.
    const transactionId =
      // Prefer explicit query param if present
      searchParams.get("transactionId") ||
      searchParams.get("TranID") ||
      // Prefer NIB's `txnRef` which mirrors our original transactionId
      parsedBody?.txnRef ||
      // Fallbacks in case of different field naming
      parsedBody?.transactionId ||
      parsedBody?.TranID;

    const paidByNumberRaw =
      parsedBody?.paidByNumber ||
      parsedBody?.payerPhone ||
      parsedBody?.PayerPhone ||
      null;

    if (!transactionId) {
      console.error("[NIB NOTIFY] Error: Transaction reference (txnRef or transactionId) not found in callback body or query.", { body: rawBody, query: Object.fromEntries(searchParams) });
      // Acknowledge receipt to NIB to prevent retries, but indicate an issue.
      return NextResponse.json({ message: "OK" }, { status: 200 });
    }

    console.log("[NIB NOTIFY] Found transactionId:", transactionId);
    if (paidByNumberRaw) {
      console.log("[NIB NOTIFY] paidByNumber (raw):", paidByNumberRaw);
    }

    // 6. Complete the payment + issue tickets in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      // 6.a) Mark the payment as completed and load the related pending order
      const payment = await tx.eventPayment.findUnique({
        where: { transactionId },
        include: { pendingOrder: true },
    });

      if (!payment) {
        console.log("[NIB NOTIFY] No EventPayment found for transactionId");
        return { alreadyCompleted: false, order: null, attendees: [] as any[] };
      }

      // Update payment status if needed
      if (payment.status !== "COMPLETED") {
        await tx.eventPayment.update({
          where: { id: payment.id },
          data: {
            status: "COMPLETED",
            paymentDate: new Date(),
          },
        });
      }

      const order = await tx.pendingOrder.findUnique({
        where: { id: payment.pendingOrderId },
      });

      if (!order) {
        console.log(
          "[NIB NOTIFY] No PendingOrder linked to EventPayment:",
          payment.id
        );
        return { alreadyCompleted: false, order: null, attendees: [] as any[] };
      }

      // If order is already completed, do not create tickets again
      if (order.status === "COMPLETED" && order.attendeeId) {
        const existingAttendees = await tx.attendee.findMany({
          where: {
            eventId: order.eventId,
            // We only know the "primary" attendeeId stored on the order; fetch all
            // attendees that match the same person details from attendeeData.
            name: (order.attendeeData as any)?.name,
            phoneNumber: (order.attendeeData as any)?.phoneNumber,
            userId: (order.attendeeData as any)?.userId,
          },
        });

        return {
          alreadyCompleted: true,
          order,
          attendees: existingAttendees,
        };
      }

      // Validate paidByNumber against the phone number stored on the order
      const orderPhoneNormalized = normalizePhone(
        (order.attendeeData as any)?.phoneNumber ?? null
      );
      const paidByNormalized = normalizePhone(paidByNumberRaw);

      if (paidByNormalized && orderPhoneNormalized) {
        if (paidByNormalized !== orderPhoneNormalized) {
          console.warn(
            "[NIB NOTIFY] paidByNumber does not match pending order phone.",
            {
              paidByNormalized,
              orderPhoneNormalized,
              transactionId,
            }
          );
        } else {
          console.log(
            "[NIB NOTIFY] paidByNumber matches pending order phone for transaction:",
            transactionId
          );
        }
      }

      // 6.b) Issue attendees (tickets)
      const attendeeData = order.attendeeData as {
        name: string;
        phoneNumber?: string;
        userId?: string;
        quantity?: number;
      };

      const qty = attendeeData.quantity || 1;

      if (!order.ticketTypeId) {
        throw new Error("[NIB NOTIFY] PendingOrder is missing ticketTypeId");
      }

      // Ensure the ticket type exists and update its sold count
      const ticketType = await tx.ticketType.findUnique({
        where: { id: order.ticketTypeId },
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
