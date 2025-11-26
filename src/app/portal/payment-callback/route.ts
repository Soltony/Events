
'use server';

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {                                       
    // 1. Raw body
    const rawBody = await req.text();
    console.log("[NIB NOTIFY] Raw body:", rawBody);

    // 2. Parse JSON if any                                             
    let parsedBody: any = null;
    if (rawBody.trim()) {
      try {
        parsedBody = JSON.parse(rawBody);
        console.log("[NIB NOTIFY] Parsed JSON body:", parsedBody);
      } catch {
        console.log("[NIB NOTIFY] Body is not JSON");
      }
    }

    // 3. Log headers
    console.log("[NIB NOTIFY] Headers:", Object.fromEntries(req.headers));

    // 4. Log full URL & query
    const { searchParams } = new URL(req.url);
    console.log("[NIB NOTIFY] Full URL:", req.url);
    console.log("[NIB NOTIFY] Query params:", Object.fromEntries(searchParams));

    // 5. Get our internal transactionId.
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

    if (!transactionId) {
      console.log("[NIB NOTIFY] No transactionId found anywhere");
      return NextResponse.json({ message: "OK" }, { status: 200 });
    }

    console.log("[NIB NOTIFY] Found transactionId:", transactionId);

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

      if (!ticketType) {
        throw new Error("[NIB NOTIFY] Ticket type not found");
      }

      const createdAttendees = [];
      for (let i = 0; i < qty; i++) {
        const attendee = await tx.attendee.create({
          data: {
            name: attendeeData.name,
            phoneNumber: attendeeData.phoneNumber,
            eventId: order.eventId,
            ticketTypeId: ticketType.id,
            userId: attendeeData.userId, // Save the userId
            checkedIn: false,
            qrCode: randomUUID(),
          },
        });
        createdAttendees.push(attendee);
      }

      await tx.ticketType.update({
        where: { id: ticketType.id },
        data: { sold: { increment: qty } },
      });

      // Handle promo code usage, if any
      if (order.promoCode) {
        const promo = await tx.promoCode.findFirst({
          where: { code: order.promoCode, eventId: order.eventId },
        });
        if (promo) {
          await tx.promoCode.update({
            where: { id: promo.id },
            data: { uses: { increment: qty } },
          });
        }
      }

      const primaryAttendeeId = createdAttendees[createdAttendees.length - 1]?.id;

      const updatedOrder = await tx.pendingOrder.update({
        where: { id: order.id },
        data: {
          status: "COMPLETED",
          attendeeId: primaryAttendeeId,
        },
      });

      return {
        alreadyCompleted: false,
        order: updatedOrder,
        attendees: createdAttendees,
      };
    });

    if (!result.order) {
      // No related order/payment – acknowledge to avoid retries, but no ticket data
      return NextResponse.json({ message: "OK" }, { status: 200 });
    }

    // Shape response for frontend (/checkout/complete) to consume
    return NextResponse.json(
      {
        success: true,
        orderId: result.order.id,
        status: result.order.status,
        alreadyCompleted: result.alreadyCompleted,
        items: result.attendees.map((a) => ({
          id: a.id,
          name: a.name,
          phoneNumber: a.phoneNumber,
          eventId: a.eventId,
          ticketTypeId: a.ticketTypeId,
          qrCode: a.qrCode,
          checkedIn: a.checkedIn,
        })),
      },
      { status: 200 }
    );

  } catch (err) {
    console.error("[NIB NOTIFY] Fatal error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 200 });
  }
}
