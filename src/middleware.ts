import { NextRequest, NextResponse } from "next/server";
import { verifyHs256Jwt } from "@/lib/jwt-edge";
import { shouldUseSecureCookies } from "@/lib/cookie";
import {
  CSRF_BOOTSTRAP_HEADER,
  CSRF_COOKIE,
  CSRF_REQUEST_HEADER,
  LEGACY_CSRF_COOKIE,
  csrfTokensMatch,
  generateCsrfToken,
} from "@/lib/csrf-token";

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

const isDev = process.env.NODE_ENV !== "production";

/**
 * Per-request Content Security Policy.
 *
 * Scripts: only those carrying this request's nonce (Next.js applies it to its own
 * scripts automatically), plus scripts they load ('strict-dynamic'). No 'unsafe-inline',
 * no 'unsafe-eval' (dev only — React Refresh needs it), no data:/blob: scripts.
 *
 * Styles: <style>/<link> elements need the nonce or an allow-listed origin. Inline style
 * *attributes* stay allowed (style-src-attr): React/Radix render `style="…"` attributes
 * during SSR, and attributes can neither run script nor carry selector-based CSS
 * exfiltration, which requires a <style> element.
 */
function buildCsp(nonce: string): string {
  const styleSources = `'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`} https://fonts.googleapis.com`;
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src ${styleSources}`,
    `style-src-elem ${styleSources}`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data: https://placehold.co https://storage.googleapis.com https://picsum.photos",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://nominatim.openstreetmap.org",
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function normalizeHost(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const host = value.split(",")[0].trim().toLowerCase();
  return host || null;
}

/** Host part of a browser Origin value, or null when it is not a valid http(s) origin. */
function originHostOf(origin: string): string | null {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" || url.protocol === "http:" ? url.host.toLowerCase() : null;
  } catch {
    return null; // e.g. "Missed", "null", garbage
  }
}

/** Hosts allowed to send state-changing requests: this site, plus optional ALLOWED_ORIGINS. */
function allowedHosts(request: NextRequest): Set<string> {
  const hosts = new Set<string>();
  const self = normalizeHost(request.headers.get("x-forwarded-host")) ?? normalizeHost(request.headers.get("host"));
  if (self) hosts.add(self);
  for (const entry of (process.env.ALLOWED_ORIGINS ?? "").split(",")) {
    const host = entry.trim() ? originHostOf(entry.trim()) : null;
    if (host) hosts.add(host);
  }
  return hosts;
}

/**
 * Origin validation for browser-initiated, state-changing requests: every POST/PUT/PATCH/
 * DELETE to /api/* and every Server Action. Browsers always send Origin on these, so:
 *   - missing / empty Origin            → 400 JSON
 *   - malformed Origin (e.g. "Missed")  → 400 JSON
 *   - Origin from another site          → 403 JSON
 * The header is null-checked before any string operation, so a missing or odd value can
 * never raise an exception. Server-to-server callbacks (/portal/payment-callback) are not
 * under /api and are authenticated by their own token checks instead.
 */
function isProtectedStateChange(request: NextRequest): boolean {
  const isServerAction = request.method === "POST" && request.headers.has("next-action");
  const isStateChangingApi =
    STATE_CHANGING_METHODS.has(request.method) && request.nextUrl.pathname.startsWith("/api/");
  return isServerAction || isStateChangingApi;
}

function checkRequestOrigin(request: NextRequest): NextResponse | null {
  if (!isProtectedStateChange(request)) return null;

  const origin = request.headers.get("origin");
  if (origin === null || origin.trim() === "") {
    return jsonError("Missing Origin header.", 400);
  }
  const originHost = originHostOf(origin.trim());
  if (originHost === null) {
    return jsonError("Invalid Origin header.", 400);
  }
  if (!allowedHosts(request).has(originHost)) {
    return jsonError("Cross-origin request rejected.", 403);
  }
  return null;
}

/** Cookies that make a request act as a signed-in user or identified guest. */
const SESSION_COOKIES = ["auth_token", "refresh_token", "super_admin_token", "superapp_token", "phone_number"];

/**
 * A read made by script on behalf of a session: fetch/XHR calls, including the Next.js
 * router's RSC navigation and prefetch requests (`?_rsc=`). Next strips the RSC header before
 * middleware runs, so these are recognised as "not a document load": Sec-Fetch-Dest "empty"
 * (or, without Sec-Fetch headers, an Accept that does not ask for HTML).
 *
 * Top-level page loads, images/scripts/styles and static files stay token-free: a first visit
 * has no token yet, and none of these can be read by a cross-site page.
 */
function isScriptedSessionRead(request: NextRequest): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const { pathname } = request.nextUrl;
  if (pathname === "/api/csrf-token" || /\.[a-z0-9]+$/i.test(pathname)) return false;
  if (!SESSION_COOKIES.some((name) => !!request.cookies.get(name)?.value)) return false;
  const dest = request.headers.get("sec-fetch-dest");
  if (dest) return dest === "empty";
  return !(request.headers.get("accept") ?? "").includes("text/html");
}

/**
 * CSRF token check: the X-CSRF-Token header must equal the HttpOnly `csrf_secret` cookie on
 *   - every request checkRequestOrigin covers (POST/PUT/PATCH/DELETE /api/*, Server Actions), and
 *   - scripted reads made with a session cookie (see isScriptedSessionRead).
 * Missing cookie, missing header or a wrong value → 403 JSON. The browser gets the value from
 * <meta name="csrf-token"> or GET /api/csrf-token (src/lib/csrf-client.ts), which a cross-site
 * page cannot read. A rejected router fetch makes Next fall back to a full page load, which
 * re-issues the cookie, so a user whose cookie was cleared recovers on their own.
 */
function checkCsrfToken(request: NextRequest): NextResponse | null {
  if (!isProtectedStateChange(request) && !isScriptedSessionRead(request)) return null;
  const header = request.headers.get(CSRF_REQUEST_HEADER) ?? "";
  const secret = request.cookies.get(CSRF_COOKIE)?.value ?? "";
  if (!csrfTokensMatch(header.trim(), secret)) {
    return jsonError("Invalid CSRF token.", 403);
  }
  return null;
}

type AccessClaims = { userId?: string; type?: string };
type SuperAdminClaims = { superAdminId?: string; type?: string };

let warnedMissingSecret = false;
function missingSecret(name: string) {
  if (!warnedMissingSecret) {
    warnedMissingSecret = true;
    console.error(`[middleware] ${name} is not available; edge auth gate falls back to server-side checks only.`);
  }
}

/** A signed, unexpired access token (signature verified — presence alone is not enough). */
async function hasValidUserSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return false;
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    missingSecret("JWT_SECRET");
    return true; // pages/actions still verify the token server-side
  }
  const claims = await verifyHs256Jwt<AccessClaims>(token, secret);
  return !!claims?.userId && (!claims.type || claims.type === "access");
}

async function hasValidSuperAdminSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("super_admin_token")?.value;
  if (!token) return false;
  const secret = process.env.SUPER_ADMIN_JWT_SECRET;
  if (!secret) {
    missingSecret("SUPER_ADMIN_JWT_SECRET");
    return true;
  }
  const claims = await verifyHs256Jwt<SuperAdminClaims>(token, secret);
  return !!claims?.superAdminId && claims.type === "super_admin_access";
}

async function authGate(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;

  // Basic auth gate for privileged pages/APIs.
  // Full permission checks still happen server-side in pages/actions/routes.
  if (
    pathname.startsWith("/dashboard") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname.startsWith("/api/upload")
  ) {
    if (!(await hasValidUserSession(request))) {
      if (pathname.startsWith("/api/")) {
        return jsonError("Authentication required", 401);
      }
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  const isSuperAdminPage =
    pathname.startsWith("/super-admin/") && !pathname.startsWith("/super-admin/login");
  if (isSuperAdminPage && !(await hasValidSuperAdminSession(request))) {
    const url = request.nextUrl.clone();
    url.pathname = "/super-admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return null;
}

export async function middleware(request: NextRequest) {
  try {
    const originRejection = checkRequestOrigin(request);
    if (originRejection) return originRejection;

    const csrfRejection = checkCsrfToken(request);
    if (csrfRejection) return csrfRejection;

    const { pathname, search } = request.nextUrl;

    const denied = await authGate(request);
    if (denied) return denied;

    const nonce = generateNonce();
    const csp = buildCsp(nonce);
    const requestHeaders = new Headers(request.headers);
    // Next.js reads the nonce from the request's CSP header and applies it to the scripts
    // it renders; the root layout reads x-nonce for our own runtime <style> elements.
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("content-security-policy", csp);

    // Issue the CSRF secret on first contact and hand its value to the root layout
    // (<meta name="csrf-token">) and /api/csrf-token. Always overwritten, never client-supplied.
    const existingCsrf = request.cookies.get(CSRF_COOKIE)?.value;
    const csrfToken = existingCsrf || generateCsrfToken();
    requestHeaders.set(CSRF_BOOTSTRAP_HEADER, csrfToken);

    const authHeader = request.headers.get("authorization");
    const hasBearerAuth = !!authHeader?.startsWith("Bearer ");
    const hasPortalSession =
      !!request.cookies.get("superapp_token")?.value ||
      !!request.cookies.get("auth_token")?.value;

    let response: NextResponse;
    if (
      request.method === "GET" &&
      hasBearerAuth &&
      !hasPortalSession &&
      pathname !== "/portal/connect" &&
      !pathname.startsWith("/api/")
    ) {
      const connectUrl = request.nextUrl.clone();
      connectUrl.pathname = "/portal/connect";
      connectUrl.searchParams.set("returnTo", `${pathname}${search}`);
      response = NextResponse.rewrite(connectUrl, { request: { headers: requestHeaders } });
    } else {
      response = NextResponse.next({ request: { headers: requestHeaders } });
    }

    response.headers.set("Content-Security-Policy", csp);

    const secure = shouldUseSecureCookies();
    if (!existingCsrf) {
      response.cookies.set(CSRF_COOKIE, csrfToken, { httpOnly: true, secure, sameSite: "strict", path: "/" });
    }
    if (request.cookies.has(LEGACY_CSRF_COOKIE)) {
      // Expire the old JS-readable mirror cookie (the expiring Set-Cookie is HttpOnly too).
      response.cookies.set(LEGACY_CSRF_COOKIE, "", { httpOnly: true, secure, sameSite: "strict", path: "/", maxAge: 0 });
    }
    return response;
  } catch (error) {
    console.error("[middleware] Unhandled error:", error instanceof Error ? error.message : error);
    return jsonError("An unexpected error occurred.", 500);
  }
}
