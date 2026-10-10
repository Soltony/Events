import { Prisma } from '@prisma/client';

/**
 * Converts an unknown error into a message that is safe to show to a client.
 *
 * Database/ORM errors (and any other library error) can carry query text, model names,
 * driver codes and other internals, so they are never surfaced verbatim — they are mapped
 * to a generic message and the detail stays in the server log. Only plain `Error`s thrown
 * deliberately by application code (e.g. `throw new Error('Permission denied.')`) are
 * passed through.
 */
export function safeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return 'A record with that value already exists.';
      case 'P2003':
      case 'P2014':
        return 'This record is still referenced by other records and cannot be modified.';
      case 'P2025':
        return 'The record no longer exists.';
      default:
        return fallback;
    }
  }
  if (
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientValidationError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    return fallback;
  }
  // Application errors are plain `Error`s; subclasses (TypeError, library errors, …) are not.
  if (error instanceof Error && error.constructor === Error && error.message) {
    return error.message;
  }
  return fallback;
}
