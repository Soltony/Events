import crypto from 'crypto';

export function hashRefreshToken(token: string) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function getMaxActiveSessions() {
  const raw = process.env.MAX_ACTIVE_SESSIONS;
  const n = raw ? Number(raw) : 1;
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.floor(n);
}

export function getMaxActiveSuperAdminSessions() {
  const raw = process.env.MAX_ACTIVE_SUPER_ADMIN_SESSIONS;
  const n = raw ? Number(raw) : 1;
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.floor(n);
}

// Inactivity window for a regular user session (default 30 min). After this
// much idle time the session is revoked server-side and re-auth is required.
export function getUserIdleTimeoutSeconds() {
  const n = Number(process.env.USER_IDLE_TIMEOUT_SECONDS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30 * 60;
}

// Absolute lifetime of a user session regardless of activity (default 12h).
export function getUserSessionAbsoluteMaxAgeSeconds() {
  const n = Number(process.env.USER_SESSION_ABSOLUTE_MAX_AGE_SECONDS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 12 * 60 * 60;
}

// Don't rewrite `lastUsedAt` more often than this.
export const SESSION_TOUCH_THROTTLE_MS = 60 * 1000;

