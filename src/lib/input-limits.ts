// Upper bounds for every array accepted from the network (VA-026). The same numbers back
// the client-side zod schemas (.max()) and the server-side checks, so oversized input is
// rejected before it is iterated, validated or written to the database.

export const INPUT_LIMITS = {
  eventLocations: 50,
  eventImages: 5,
  ticketTiers: 50,
  locationPricesPerTier: 50,
  rolePermissions: 200,
  clientTicketTypes: 500,
} as const;

/** Throws unless `value` is absent or an array of at most `max` items. */
export function assertMaxItems(value: unknown, max: number, label: string): void {
  if (value === undefined || value === null) return;
  if (!Array.isArray(value)) throw new Error(`Invalid ${label}.`);
  if (value.length > max) throw new Error(`Too many ${label} (maximum ${max}).`);
}
