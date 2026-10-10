import type { PromoCode } from '@prisma/client';

/**
 * Promo codes are either plain (`SUMMER10`) or structured as `TYPE:VALUE:CODE`:
 *   - `TICKET:<ticket type name>:<code>`  — only valid when that ticket type is in the cart
 *   - `LOCATION:<location>:<code>`        — only valid for tickets at that location
 *
 * Shared by the client-facing validator and the server-side order pricing so both
 * always agree on whether a code applies.
 */
export function matchPromoCode<P extends Pick<PromoCode, 'code'>>(
  promos: P[],
  code: string,
  location: string | null | undefined,
  ticketTypesInCart: { name: string }[] | undefined,
): P | null {
  for (const promo of promos) {
    if (promo.code === code) return promo;

    if (!promo.code.includes(':')) continue;
    const [type, value, actualCode] = promo.code.split(':');
    if (actualCode !== code) continue;

    if (type === 'TICKET' && ticketTypesInCart?.some((t) => t.name === value)) {
      return promo;
    }
    if (type === 'LOCATION' && location && location === value) {
      return promo;
    }
  }
  return null;
}

/** Ticket type names are stored as `"<tier> - <location>"` for multi-location events. */
export function locationFromTicketTypeName(name: string): string | null {
  const location = name.split(' - ').slice(1).join(' - ').trim();
  return location || null;
}
