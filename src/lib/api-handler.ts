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
 * Default cap for JSON API bodies; upload routes pass a larger limit. src/middleware.ts
 * enforces the same limits on Content-Length (413) before any route handler runs.
 */
export const DEFAULT_MAX_JSON_BYTES = 64 * 1024;

/** Reads the raw body, or null as soon as it exceeds `maxBytes` (stops reading at the cap). */
async function readBodyText(req: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!req.body) return '';

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Parses a JSON object request body of at most `maxBytes`. Returns null (instead of
 * throwing) for an empty, malformed, oversized or non-object body, so callers can answer
 * 400 rather than crash with a 500 — and oversized input is never handed to JSON.parse
 * or any downstream validation.
 */
export async function readJsonBody<T extends Record<string, any> = Record<string, any>>(
  req: Request,
  { maxBytes = DEFAULT_MAX_JSON_BYTES }: { maxBytes?: number } = {},
): Promise<T | null> {
  const text = await readBodyText(req, maxBytes);
  if (text === null) return null;
  try {
    const body = JSON.parse(text);
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
