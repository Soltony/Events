import { Prisma, type PendingOrder, type TicketType } from '@prisma/client';
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { locationFromTicketTypeName, matchPromoCode } from '@/lib/promo';
import { normalizeEthiopianPhoneStrict, normalizePhoneNumber } from '@/lib/utils';

/**
 * Server-side order pricing and fulfilment.
 *
 * Every amount that decides whether — and how much — a buyer pays is derived here
 * from database prices. Client-supplied prices/totals are never trusted.
 */

const MAX_ORDER_LINES = 50;
const MAX_TICKETS_PER_LINE = 100;

type Db = Prisma.TransactionClient | typeof prisma;

/** An error whose message is safe to return to the client. */
export class OrderError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'OrderError';
  }
}

/** Thrown when an order (or its payment) was already completed by another request. */
export class OrderAlreadyCompletedError extends Error {
  constructor() {
    super('Order already completed.');
    this.name = 'OrderAlreadyCompletedError';
  }
}

export type OrderLine = { id: number; quantity: number };

export type PendingOrderData = {
  name: string;
  phoneNumber?: string | null;
  userId?: string | null;
  quantity?: number;
  tickets: unknown;
  isGift?: boolean;
  purchasedById?: string | null;
  purchasedByName?: string | null;
};

/** Validates and normalises the ticket lines of an order (positive integer ids and quantities). */
export function parseOrderLines(raw: unknown): OrderLine[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ORDER_LINES) {
    throw new OrderError('Invalid ticket selection.');
  }
  const byId = new Map<number, number>();
  for (const item of raw) {
    const id = Number((item as any)?.id);
    const quantity = Number((item as any)?.quantity);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
      throw new OrderError('Invalid ticket selection.');
    }
    byId.set(id, (byId.get(id) ?? 0) + quantity);
  }
  const lines = Array.from(byId, ([id, quantity]) => ({ id, quantity }));
  if (lines.some((l) => l.quantity > MAX_TICKETS_PER_LINE)) {
    throw new OrderError('Too many tickets requested.');
  }
  return lines;
}

export function toCents(value: Prisma.Decimal | number | string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new OrderError('Invalid amount.');
  return Math.round(n * 100);
}

/** Formats cents the way amounts are sent to the payment gateway (e.g. 15000 -> "150", 8910 -> "89.1"). */
export function centsToAmountString(cents: number): string {
  return String(cents / 100);
}

/** Per-phone purchase cap configured on a ticket type's location entry (null = unlimited). */
export function getMaxTicketsPerPhone(ticketType: Pick<TicketType, 'name' | 'locationPrices'>): number | null {
  const entries: any[] = Array.isArray(ticketType.locationPrices) ? (ticketType.locationPrices as any[]) : [];
  const location = locationFromTicketTypeName(ticketType.name);
  const matched = location
    ? entries.find((e) => (e?.location ? String(e.location).trim() : null) === location)
    : entries[0];
  const max = matched?.maxTicketsPerPhone ?? matched?.maxFreeTicketsPerPhone;
  return typeof max === 'number' && max > 0 ? max : null;
}

/**
 * Finds the promo code a buyer entered. Location-scoped codes are matched against the
 * locations of the ticket types actually in the order, never a client-supplied location.
 */
async function resolvePromo(
  db: Db,
  eventId: number,
  code: string,
  ticketTypes: Pick<TicketType, 'name'>[],
  opts: { onlyAvailable: boolean },
) {
  const promos = await db.promoCode.findMany({
    where: opts.onlyAvailable ? { eventId, uses: { lt: prisma.promoCode.fields.maxUses } } : { eventId },
  });
  const cart = ticketTypes.map((t) => ({ name: t.name }));
  let match = matchPromoCode(promos, code, null, cart);
  for (const t of ticketTypes) {
    match ??= matchPromoCode(promos, code, locationFromTicketTypeName(t.name), cart);
  }
  return match;
}

export type PricedOrder = {
  lines: (OrderLine & { ticketType: TicketType })[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  promo: { id: number; code: string } | null;
};

/** Computes the authoritative price of an order from database ticket prices and promo codes. */
export async function priceOrder(
  db: Db,
  params: { eventId: number; lines: OrderLine[]; promoCode?: string | null },
): Promise<PricedOrder> {
  const { eventId, lines } = params;
  const ticketTypes = await db.ticketType.findMany({
    where: { id: { in: lines.map((l) => l.id) }, eventId },
  });
  if (ticketTypes.length !== lines.length) {
    throw new OrderError('Ticket type does not belong to this event.');
  }
  const byId = new Map(ticketTypes.map((t) => [t.id, t]));
  const pricedLines = lines.map((l) => ({ ...l, ticketType: byId.get(l.id)! }));

  const subtotalCents = pricedLines.reduce(
    (sum, l) => sum + toCents(l.ticketType.basePrice) * l.quantity,
    0,
  );

  let discountCents = 0;
  let promo: PricedOrder['promo'] = null;
  const promoCode = typeof params.promoCode === 'string' ? params.promoCode.trim() : '';
  if (promoCode) {
    const match = await resolvePromo(db, eventId, promoCode, ticketTypes, { onlyAvailable: true });
    if (!match) {
      throw new OrderError('Invalid or expired promo code.');
    }
    if (match.type === 'PERCENTAGE') {
      const pct = Math.min(100, Math.max(0, Number(match.value)));
      discountCents = Math.round((subtotalCents * pct) / 100);
    } else {
      discountCents = Math.min(subtotalCents, Math.max(0, toCents(match.value)));
    }
    promo = { id: match.id, code: match.code };
  }

  return {
    lines: pricedLines,
    subtotalCents,
    discountCents,
    totalCents: Math.max(0, subtotalCents - discountCents),
    promo,
  };
}

/** Prices a stored pending order. */
export async function pricePendingOrder(db: Db, order: Pick<PendingOrder, 'eventId' | 'attendeeData' | 'promoCode'>) {
  const data = order.attendeeData as PendingOrderData;
  return priceOrder(db, {
    eventId: order.eventId,
    lines: parseOrderLines(data?.tickets),
    promoCode: order.promoCode,
  });
}

function normalizeStoredPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  try {
    return normalizeEthiopianPhoneStrict(phone);
  } catch {
    const maybe = normalizePhoneNumber(phone);
    return maybe ? normalizeEthiopianPhoneStrict(maybe) : null;
  }
}

export type FulfilmentResult = {
  attendeeId: number | null;
  ticketTypeName: string | null;
  quantity: number;
  phoneNumber: string | null;
  data: PendingOrderData;
};

/**
 * Issues the tickets for a pending order. Must run inside a transaction.
 *
 * The order is claimed with a conditional PENDING -> COMPLETED update, so concurrent or
 * replayed calls cannot issue tickets twice (the loser gets OrderAlreadyCompletedError).
 * Stock is decremented with a guarded update so tickets can never be oversold.
 */
export async function fulfilPendingOrder(
  tx: Prisma.TransactionClient,
  order: PendingOrder,
  opts: { enforcePerPhoneLimit: boolean },
): Promise<FulfilmentResult> {
  const claim = await tx.pendingOrder.updateMany({
    where: { id: order.id, status: 'PENDING' },
    data: { status: 'COMPLETED' },
  });
  if (claim.count === 0) {
    throw new OrderAlreadyCompletedError();
  }

  const data = order.attendeeData as PendingOrderData;
  const lines = parseOrderLines(data?.tickets);
  const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);
  const phoneNumber = normalizeStoredPhone(data.phoneNumber);

  // Guest ids ("guest_<phone>") and stale ids are not valid foreign keys.
  let userId: string | null = null;
  if (data.userId && !data.userId.startsWith('guest_')) {
    const user = await tx.user.findUnique({ where: { id: data.userId }, select: { id: true } });
    userId = user?.id ?? null;
  }

  const ticketTypes = await tx.ticketType.findMany({
    where: { id: { in: lines.map((l) => l.id) }, eventId: order.eventId },
  });
  const byId = new Map(ticketTypes.map((t) => [t.id, t]));
  if (ticketTypes.length !== lines.length) {
    throw new OrderError('Ticket type does not belong to this event.');
  }

  if (opts.enforcePerPhoneLimit) {
    const primary = byId.get(order.ticketTypeId) ?? ticketTypes[0];
    const max = getMaxTicketsPerPhone(primary);
    if (max !== null) {
      if (!phoneNumber) throw new OrderError('A phone number is required for this ticket.');
      const alreadyClaimed = await tx.attendee.count({ where: { phoneNumber, eventId: order.eventId } });
      if (alreadyClaimed + totalQuantity > max) {
        throw new OrderError('Ticket limit exceeded for this user');
      }
    }
  }

  let lastAttendeeId: number | null = null;
  let lastTicketTypeName: string | null = null;

  for (const line of lines) {
    const ticketType = byId.get(line.id)!;

    const reserved = await tx.ticketType.updateMany({
      where: { id: ticketType.id, sold: { lte: ticketType.total - line.quantity } },
      data: { sold: { increment: line.quantity } },
    });
    if (reserved.count === 0) {
      throw new OrderError(`Not enough tickets available for "${ticketType.name}".`, 409);
    }

    await tx.attendee.createMany({
      data: Array.from({ length: line.quantity }, () => ({
        name: data.name,
        phoneNumber: phoneNumber ?? undefined,
        userId,
        eventId: order.eventId,
        ticketTypeId: ticketType.id,
        checkedIn: false,
        qrCode: randomUUID(),
        isGift: !!data.isGift,
        purchasedById: data.purchasedById ?? null,
        purchasedByName: data.purchasedByName ?? null,
      })),
    });

    const last = await tx.attendee.findFirst({
      where: { eventId: order.eventId, ticketTypeId: ticketType.id, name: data.name, phoneNumber, userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    lastAttendeeId = last?.id ?? lastAttendeeId;
    lastTicketTypeName = ticketType.name;
  }

  if (order.promoCode) {
    // The order was priced (and paid) with this code already, so don't re-check remaining uses here.
    const promo = await resolvePromo(tx, order.eventId, order.promoCode, ticketTypes, { onlyAvailable: false });
    if (promo) {
      await tx.promoCode.update({ where: { id: promo.id }, data: { uses: { increment: totalQuantity } } });
    }
  }

  await tx.pendingOrder.update({ where: { id: order.id }, data: { attendeeId: lastAttendeeId } });

  return { attendeeId: lastAttendeeId, ticketTypeName: lastTicketTypeName, quantity: totalQuantity, phoneNumber, data };
}
