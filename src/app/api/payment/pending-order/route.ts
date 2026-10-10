import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { normalizeEthiopianPhoneStrict } from '@/lib/utils';
import { verifyAuth } from '@/lib/auth-middleware';
import { getMaxTicketsPerPhone, OrderError, parseOrderLines, priceOrder } from '@/lib/orders';
import { withApiErrorHandling } from '@/lib/api-handler';

interface BuyerIdentity {
    purchasedById: string | null;
    purchasedByName: string;
}

// Identifies the buyer for gift attribution. A full account or a JWT-based guest session
// both resolve via verifyAuth. Many NIB SuperApp visitors, however, only ever carry the
// SuperApp's plain `phone_number` cookie with no JWT at all — that's still
// a legitimate identified buyer, just with a phone number as their only identifier.
async function resolveBuyerIdentity(req: NextRequest): Promise<BuyerIdentity | null> {
    const verified = await verifyAuth(req);
    if (verified) {
        return verified.isGuest
            ? { purchasedById: null, purchasedByName: verified.phoneNumber }
            : { purchasedById: verified.id, purchasedByName: `${verified.firstName} ${verified.lastName}`.trim() };
    }

    const cookieStore = await cookies();
    const guestPhone = cookieStore.get('phone_number')?.value;
    if (guestPhone) {
        return { purchasedById: null, purchasedByName: guestPhone };
    }

    return null;
}

export const POST = withApiErrorHandling(async function POST(req: NextRequest) {
    try {
        let body: any;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
        }
        const { eventId, tickets, promoCode, attendeeDetails, isGift } = body ?? {};

        if (!Number.isInteger(eventId) || !Array.isArray(tickets) || tickets.length === 0 || !attendeeDetails) {
            return NextResponse.json({
                error: 'Invalid request payload',
                detail: 'Required fields: eventId, tickets[], attendeeDetails.'
            }, { status: 400 });
        }
        if (promoCode != null && typeof promoCode !== 'string') {
            return NextResponse.json({ error: 'Invalid promo code.' }, { status: 400 });
        }

        // Best-effort buyer attribution for gifts — see resolveBuyerIdentity for the
        // full/guest/cookie-only tiers this covers. Never blocks the purchase: if no identity
        // is found, the gift still goes through with purchasedById/purchasedByName left null.
        const buyerIdentity: BuyerIdentity | null = isGift ? await resolveBuyerIdentity(req) : null;

        const eventRecord = await prisma.event.findUnique({
          where: { id: eventId },
          select: { id: true, startDate: true, endDate: true, status: true },
        });
        if (!eventRecord || eventRecord.status !== 'APPROVED') {
          return NextResponse.json({ error: 'Event unavailable' }, { status: 404 });
        }
        const eventEndTime = eventRecord.endDate ? new Date(eventRecord.endDate) : new Date(eventRecord.startDate);
        if (eventEndTime.getTime() < Date.now()) {
          return NextResponse.json(
            { error: 'Ticket sales closed', detail: 'This event has already ended.' },
            { status: 400 }
          );
        }

        // Validates every line (positive integer ids/quantities, every ticket type belongs to
        // this event) and the promo code. Prices are never taken from the client.
        const priced = await priceOrder(prisma, { eventId, lines: parseOrderLines(tickets), promoCode });
        const totalQuantity = priced.lines.reduce((sum, l) => sum + l.quantity, 0);
        const primaryTicketType = priced.lines[0].ticketType;

        // This transactionId is our internal reference for the entire purchase flow.
        const transactionId = randomUUID();

        let normalizedPhone: string;
        try {
            normalizedPhone = normalizeEthiopianPhoneStrict(attendeeDetails.phone);
        } catch (e: any) {
            return NextResponse.json(
                { error: e?.message || 'Invalid phone number.' },
                { status: 400 }
            );
        }

        // For gifts, no recipient account is required at purchase time — the ticket is
        // assigned by phone number alone (attendeeDetails.name is buyer-provided, same as
        // the self-purchase path). It becomes visible to the recipient the moment they log
        // in with a matching phone number (see getTicketsForUser's phone-match lookup).
        const recipientName = attendeeDetails.name;
        const recipientUserId: string | undefined = isGift ? undefined : attendeeDetails.userId;

        // Per-phone limit (stored in `ticketType.locationPrices` JSON).
        const max = getMaxTicketsPerPhone(primaryTicketType);
        if (max !== null) {
          const alreadyClaimed = await prisma.attendee.count({
            where: { phoneNumber: normalizedPhone, eventId },
          });
          if (alreadyClaimed + totalQuantity > max) {
            return NextResponse.json(
              {
                success: false,
                error: `Ticket limit exceeded for this user`,
              },
              { status: 400 }
            );
          }
        }

        const purchasedById = buyerIdentity?.purchasedById ?? null;
        const purchasedByName = buyerIdentity?.purchasedByName ?? null;

        const pendingOrder = await prisma.pendingOrder.create({
            data: {
                transactionId: transactionId,
                eventId,
                ticketTypeId: primaryTicketType.id, // Store primary ticket type
                attendeeData: {
                    name: recipientName,
                    phoneNumber: normalizedPhone,
                    userId: recipientUserId,
                    quantity: totalQuantity,
                    // Only ids/quantities (plus a name snapshot) — never client-supplied prices.
                    tickets: priced.lines.map((l) => ({ id: l.id, name: l.ticketType.name, quantity: l.quantity })),
                    isGift: !!isGift,
                    purchasedById,
                    purchasedByName,
                },
                promoCode: priced.promo ? promoCode.trim() : null,
                status: 'PENDING',
                arifpaySessionId: transactionId, // Use this field to store our internal transaction ID
            },
        });

        return NextResponse.json({ success: true, transactionId: pendingOrder.transactionId });
    } catch (error: any) {
        if (error instanceof OrderError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error(`Pending order creation failed:`, error?.message);
        return NextResponse.json({
            error: 'Unexpected server error',
            detail: `An unknown error occurred while creating the pending order.`
        }, { status: 500 });
    }
});
