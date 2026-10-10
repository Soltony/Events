/**
 * HS256 JWT verification for the Edge runtime (middleware), using Web Crypto.
 *
 * Mirrors `verifyJwt` in ./jwt.ts: the header must declare HS256, the signature must be
 * present and valid, and `exp` / `nbf` are enforced. Anything else is rejected.
 */

const CLOCK_TOLERANCE_SECONDS = 5;
const encoder = new TextEncoder();
const keyCache = new Map<string, Promise<CryptoKey>>();

function base64UrlToBytes(input: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(input)) throw new Error('invalid base64url');
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJson(segment: string): any {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment)));
}

function getKey(secret: string): Promise<CryptoKey> {
  let key = keyCache.get(secret);
  if (!key) {
    key = crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    keyCache.set(secret, key);
  }
  return key;
}

/** Returns the verified payload, or null if the token is malformed, unsigned, forged or expired. */
export async function verifyHs256Jwt<T extends Record<string, unknown> = Record<string, unknown>>(
  token: string | undefined | null,
  secret: string | undefined,
): Promise<T | null> {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;

  try {
    const header = decodeJson(parts[0]);
    if (header?.alg !== 'HS256') return null;

    const valid = await crypto.subtle.verify(
      'HMAC',
      await getKey(secret),
      base64UrlToBytes(parts[2]),
      encoder.encode(`${parts[0]}.${parts[1]}`),
    );
    if (!valid) return null;

    const payload = decodeJson(parts[1]);
    if (!payload || typeof payload !== 'object') return null;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && now > payload.exp + CLOCK_TOLERANCE_SECONDS) return null;
    if (typeof payload.nbf === 'number' && now + CLOCK_TOLERANCE_SECONDS < payload.nbf) return null;
    return payload as T;
  } catch {
    return null;
  }
}
