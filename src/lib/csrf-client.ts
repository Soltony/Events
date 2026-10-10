/**
 * Browser side of the CSRF check enforced in src/middleware.ts.
 *
 * The secret only ever lives in the HttpOnly `csrf_secret` cookie. The page learns the
 * same value from the root layout (via <CsrfTokenProvider>, src/components/csrf-token-provider.tsx)
 * or from GET /api/csrf-token, and echoes it in the X-CSRF-Token header. A cross-site page
 * can make the browser send the cookie, but can read neither the page nor that response,
 * so it cannot produce a matching header.
 *
 * Importing this module installs a fetch wrapper that adds the header to every same-origin
 * request — including Server Actions and the router's RSC navigation/prefetch fetches — and
 * retries once with a fresh token if the server answers "Invalid CSRF token." (e.g. the
 * cookie was cleared while the tab was open). Axios requests get the same treatment from the
 * interceptors in src/lib/api.ts.
 */

export const CSRF_HEADER = 'X-CSRF-Token';

let cachedToken: string | null = null;
let nativeFetch: typeof fetch | null = null;

export function getCsrfToken(): string {
  return cachedToken ?? '';
}

/** Called by <CsrfTokenProvider> with the token the middleware issued for this page load. */
export function setCsrfToken(token: string) {
  cachedToken = token || null;
}

/** Fetches the token for this browser's `csrf_secret` cookie (issuing one if missing). */
export async function refreshCsrfToken(): Promise<string> {
  const doFetch = nativeFetch ?? fetch;
  const res = await doFetch('/api/csrf-token', { credentials: 'same-origin', cache: 'no-store' });
  if (!res.ok) throw new Error(`CSRF token request failed (${res.status})`);
  const body = await res.json().catch(() => null);
  cachedToken = typeof body?.csrfToken === 'string' && body.csrfToken ? body.csrfToken : null;
  return cachedToken ?? '';
}

export async function ensureCsrfToken(): Promise<string> {
  const token = getCsrfToken();
  if (token) return token;
  try {
    return await refreshCsrfToken();
  } catch (error) {
    console.error('[ensureCsrfToken] Failed to obtain CSRF token:', error);
    throw error;
  }
}

function isSameOrigin(url: string): boolean {
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

async function isCsrfRejection(response: Response): Promise<boolean> {
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) return false;
  const body = await response.clone().json().catch(() => null);
  return body?.message === 'Invalid CSRF token.';
}

function installFetchGuard() {
  if (typeof window === 'undefined' || nativeFetch) return;
  const original = window.fetch.bind(window);
  nativeFetch = original;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    const url = request ? request.url : String(input);
    if (!isSameOrigin(url)) return original(input, init);

    const headers = new Headers(init?.headers ?? request?.headers);
    if (headers.has(CSRF_HEADER) && headers.get(CSRF_HEADER)) return original(input, init);
    const token = getCsrfToken() || (await refreshCsrfToken().catch(() => ''));
    if (token) headers.set(CSRF_HEADER, token);
    const response = await original(input, { ...init, headers });

    // Retry once with the server's current token. Request objects are skipped: their body
    // may already have been consumed.
    if (response.status === 403 && !request && (await isCsrfRejection(response))) {
      const fresh = await refreshCsrfToken().catch(() => '');
      if (fresh && fresh !== token) {
        headers.set(CSRF_HEADER, fresh);
        return original(input, { ...init, headers });
      }
    }
    return response;
  };
}

installFetchGuard();
