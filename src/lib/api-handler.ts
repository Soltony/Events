import { NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';

/**
 * Global exception handling for route handlers.
 *
 * Every exported HTTP method in the app's route.ts files is wrapped with
 * `withApiErrorHandling`, so an unexpected exception anywhere in a handler produces a
 * uniform JSON response — never an unformatted/plain-text 500, a stack trace, or an
 * internal error message. Details are logged server-side only.
 */

/** An error whose message is safe to show to the client, with its HTTP status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const MALFORMED_JSON_MESSAGE = 'Malformed request body. Expected a JSON object.';

export function apiErrorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

/**
 * Parses a JSON object request body. Returns null (instead of throwing) for an empty,
 * malformed or non-object body, so callers can answer 400 rather than crash with a 500.
 */
export async function readJsonBody<T extends Record<string, any> = Record<string, any>>(
  req: Request,
): Promise<T | null> {
  try {
    const body = await req.json();
    return body !== null && typeof body === 'object' && !Array.isArray(body) ? (body as T) : null;
  } catch {
    return null;
  }
}

export function malformedJsonResponse() {
  return apiErrorResponse(MALFORMED_JSON_MESSAGE, 400);
}

export function withApiErrorHandling<A extends unknown[]>(
  handler: (...args: A) => Promise<Response> | Response,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (error) {
      // Let Next.js control-flow signals (redirect(), notFound(), dynamic rendering bail-outs)
      // propagate untouched.
      unstable_rethrow(error);

      if (error instanceof ApiError) {
        return apiErrorResponse(error.message, error.status);
      }
      const req = args[0] instanceof Request ? args[0] : null;
      console.error(
        `[API] Unhandled error${req ? ` in ${req.method} ${new URL(req.url).pathname}` : ''}:`,
        error,
      );
      return apiErrorResponse('An unexpected error occurred. Please try again later.', 500);
    }
  };
}
