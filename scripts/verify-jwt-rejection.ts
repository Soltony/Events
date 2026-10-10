/**
 * VA-013 negative test suite: every protected endpoint must reject unsigned, modified,
 * incorrectly signed, algorithm-confused, expired and session-less JWTs — and still
 * accept a genuine token (positive control, so "rejects everything" cannot pass).
 *
 * Usage (against a running instance with access to the same DB and .env secrets):
 *   BASE_URL=http://localhost:3002 npx tsx scripts/verify-jwt-rejection.ts
 *
 * It creates one temporary session per identity and revokes both when done.
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { hashRefreshToken } from '../src/lib/session';

const BASE = (process.env.BASE_URL ?? 'http://localhost:3002').replace(/\/$/, '');
const ORIGIN = new URL(BASE).origin;
const JWT_SECRET = process.env.JWT_SECRET!;
const SA_SECRET = process.env.SUPER_ADMIN_JWT_SECRET!;
const prisma = new PrismaClient();

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);
const hmac = (input: string, secret: string, alg = 'sha256') => createHmac(alg, secret).update(input).digest('base64url');

/** Every way an attacker might present a token that must NOT be accepted. */
function forgeries(valid: string, secret: string, payload: Record<string, unknown>, tamper: Record<string, unknown>) {
  const [h, p, s] = valid.split('.');
  const other = jwt.sign({ ...payload, iat: now() - 5, jti: randomUUID() }, secret, { algorithm: 'HS256' });
  const tampered = b64({ ...payload, ...tamper });
  return {
    'no token': null,
    'empty token': '',
    'garbage value': 'not-a-jwt',
    'unsigned (alg "none")': `${b64({ alg: 'none', typ: 'JWT' })}.${p}.`,
    'unsigned (alg "None")': `${b64({ alg: 'None', typ: 'JWT' })}.${p}.`,
    'unsigned (alg "NONE")': `${b64({ alg: 'NONE', typ: 'JWT' })}.${p}.`,
    'signature removed ("h.p.")': `${h}.${p}.`,
    'signature segment missing ("h.p")': `${h}.${p}`,
    'payload modified, original signature': `${h}.${tampered}.${s}`,
    'payload modified, unsigned': `${b64({ alg: 'none' })}.${tampered}.`,
    'signature copied from another valid token': `${h}.${p}.${other.split('.')[2]}`,
    'signed with a wrong secret': jwt.sign(payload, 'attacker-guessed-secret', { algorithm: 'HS256' }),
    'signed with an empty secret': `${h}.${p}.${hmac(`${h}.${p}`, '')}`,
    'real secret but HS384': jwt.sign(payload, secret, { algorithm: 'HS384' }),
    'real secret but HS512': jwt.sign(payload, secret, { algorithm: 'HS512' }),
    'header says RS256 (key confusion)': (() => {
      const hh = b64({ alg: 'RS256', typ: 'JWT' });
      return `${hh}.${p}.${hmac(`${hh}.${p}`, secret)}`;
    })(),
    'correctly signed but expired': jwt.sign({ ...payload, exp: now() - 60 }, secret, { algorithm: 'HS256' }),
    'correctly signed, not yet valid (nbf)': jwt.sign({ ...payload, nbf: now() + 3600 }, secret, { algorithm: 'HS256' }),
    'correctly signed, unknown session': jwt.sign({ ...payload, sessionId: randomUUID() }, secret, { algorithm: 'HS256' }),
    'correctly signed, stale tokenVersion': jwt.sign({ ...payload, tokenVersion: -1 }, secret, { algorithm: 'HS256' }),
  };
}

type Target = { label: string; method: 'GET' | 'POST'; path: string; cookie: string; expect: 'api' | 'page'; loginPath?: string };

// API calls carry a valid CSRF pair and pages are requested the way a browser loads them, so
// the middleware's CSRF gate passes and the JWT check is what accepts or rejects the request.
const CSRF = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');

async function call(t: Target, token: string | null) {
  const headers: Record<string, string> = { origin: ORIGIN };
  const cookies: string[] = [];
  if (token !== null) cookies.push(`${t.cookie}=${token}`);
  if (t.expect === 'page') {
    headers.accept = 'text/html,application/xhtml+xml';
    headers['sec-fetch-dest'] = 'document';
  } else {
    cookies.push(`csrf_secret=${CSRF}`);
    headers['x-csrf-token'] = CSRF;
  }
  if (cookies.length) headers.cookie = cookies.join('; ');
  return fetch(BASE + t.path, { method: t.method, headers, redirect: 'manual', body: t.method === 'POST' ? '{}' : undefined });
}

function isRejected(t: Target, r: Response) {
  // 429 = the IP throttle on auth endpoints kicked in, which is also a rejection.
  if (t.expect === 'api') return r.status === 401 || r.status === 403 || r.status === 429;
  return r.status === 307 && (r.headers.get('location') ?? '').includes(t.loginPath!);
}

async function main() {
  const superAdmin = await prisma.superAdmin.findFirstOrThrow({ where: { status: 'ACTIVE' } });
  const user = await prisma.user.findFirstOrThrow({ where: { status: 'ACTIVE', role: { name: 'Admin' } } });
  const otherUser = await prisma.user.findFirst({ where: { id: { not: user.id } }, select: { id: true } });

  // Temporary genuine sessions for the positive controls.
  const saSessionId = randomUUID();
  const saPayload = { superAdminId: superAdmin.id, type: 'super_admin_access', tokenVersion: superAdmin.tokenVersion, sessionId: saSessionId };
  const saToken = jwt.sign(saPayload, SA_SECRET, { algorithm: 'HS256', expiresIn: 600 });
  await prisma.superAdminSession.create({ data: { id: saSessionId, superAdminId: superAdmin.id, tokenHash: hashRefreshToken(saToken), userAgent: 'jwt-negative-tests' } });

  const userSessionId = randomUUID();
  const userPayload = { userId: user.id, type: 'access', tokenVersion: user.tokenVersion, sessionId: userSessionId };
  const userToken = jwt.sign(userPayload, JWT_SECRET, { algorithm: 'HS256', expiresIn: 600 });
  const refreshPayload = { ...userPayload, type: 'refresh' };
  const refreshToken = jwt.sign(refreshPayload, JWT_SECRET, { algorithm: 'HS256', expiresIn: 600 });
  await prisma.session.create({ data: { id: userSessionId, userId: user.id, refreshTokenHash: hashRefreshToken(refreshToken), userAgent: 'jwt-negative-tests' } });

  const saTargets: Target[] = [
    { label: 'GET /api/super-admin/auth/me', method: 'GET', path: '/api/super-admin/auth/me', cookie: 'super_admin_token', expect: 'api' },
    { label: 'GET /api/super-admin/permissions', method: 'GET', path: '/api/super-admin/permissions', cookie: 'super_admin_token', expect: 'api' },
    { label: 'page /super-admin/dashboard', method: 'GET', path: '/super-admin/dashboard', cookie: 'super_admin_token', expect: 'page', loginPath: '/super-admin/login' },
    { label: 'page /super-admin/audit-logs', method: 'GET', path: '/super-admin/audit-logs', cookie: 'super_admin_token', expect: 'page', loginPath: '/super-admin/login' },
  ];
  const userTargets: Target[] = [
    { label: 'GET /api/auth/me', method: 'GET', path: '/api/auth/me', cookie: 'auth_token', expect: 'api' },
    { label: 'GET /api/tickets', method: 'GET', path: `/api/tickets?userId=${user.id}`, cookie: 'auth_token', expect: 'api' },
    { label: 'GET /api/payment/status/by-session', method: 'GET', path: '/api/payment/status/by-session', cookie: 'auth_token', expect: 'api' },
    { label: 'POST /api/upload', method: 'POST', path: '/api/upload', cookie: 'auth_token', expect: 'api' },
    { label: 'page /dashboard', method: 'GET', path: '/dashboard', cookie: 'auth_token', expect: 'page', loginPath: '/login' },
    { label: 'page /profile', method: 'GET', path: '/profile', cookie: 'auth_token', expect: 'page', loginPath: '/login' },
  ];
  const refreshTargets: Target[] = [
    { label: 'POST /api/auth/refresh', method: 'POST', path: '/api/auth/refresh', cookie: 'refresh_token', expect: 'api' },
  ];

  let passed = 0;
  const failed: string[] = [];
  const record = (ok: boolean, name: string, info = '') => {
    if (ok) passed++;
    else {
      failed.push(name);
      console.log(`  ✘ ${name} ${info}`);
    }
  };

  try {
    const suites: [string, Target[], string, string, Record<string, unknown>, Record<string, unknown>][] = [
      ['Super Admin token', saTargets, saToken, SA_SECRET, saPayload, { superAdminId: randomUUID() }],
      ['User access token', userTargets, userToken, JWT_SECRET, userPayload, { userId: otherUser?.id ?? randomUUID() }],
      ['User refresh token', refreshTargets, refreshToken, JWT_SECRET, refreshPayload, { userId: otherUser?.id ?? randomUUID() }],
    ];

    for (const [suite, targets, valid, secret, payload, tamper] of suites) {
      console.log(`\n${suite}`);
      const cases = forgeries(valid, secret, payload, tamper);
      for (const t of targets) {
        let rejected = 0;
        for (const [name, token] of Object.entries(cases)) {
          const r = await call(t, token);
          const ok = isRejected(t, r);
          record(ok, `${t.label} — ${name}`, `(got ${r.status} ${r.headers.get('location') ?? ''})`);
          if (ok) rejected++;
        }
        console.log(`  ${rejected === Object.keys(cases).length ? '✔' : '✘'} ${t.label}: ${rejected}/${Object.keys(cases).length} forged tokens rejected`);
      }
    }

    console.log('\nPositive controls (genuine tokens must still work)');
    const saMe = await call(saTargets[0], saToken);
    const saBody = await saMe.json().catch(() => ({}));
    record(saMe.status === 200, 'genuine super-admin token accepted by /api/super-admin/auth/me', `(got ${saMe.status})`);
    const userMe = await call(userTargets[0], userToken);
    const userBody = await userMe.json().catch(() => ({}));
    record(userMe.status === 200, 'genuine user token accepted by /api/auth/me', `(got ${userMe.status})`);
    const dash = await call(userTargets.find((t) => t.path === '/dashboard')!, userToken);
    const dashOk = dash.status === 200 || (dash.status === 307 && !(dash.headers.get('location') ?? '').includes('/login'));
    record(dashOk, 'genuine user token opens /dashboard', `(got ${dash.status} ${dash.headers.get('location') ?? ''})`);
    console.log(`  ${saMe.status === 200 && userMe.status === 200 && dashOk ? '✔' : '✘'} genuine tokens accepted (APIs and /dashboard page)`);

    const leaked = ['password', 'tokenVersion', 'failedLoginAttempts', 'lockoutUntil', 'passwordUpdatedAt'].filter(
      (f) => f in (saBody.superAdmin ?? {}) || f in (userBody.user ?? {}),
    );
    record(leaked.length === 0, 'account responses expose no security internals', leaked.join(','));
    console.log(`  ${leaked.length === 0 ? '✔' : '✘'} account responses expose no security internals`);
  } finally {
    await prisma.superAdminSession.update({ where: { id: saSessionId }, data: { revokedAt: new Date() } });
    await prisma.session.update({ where: { id: userSessionId }, data: { revokedAt: new Date() } });
    await prisma.$disconnect();
  }

  console.log(`\n${passed} passed, ${failed.length} failed`);
  assert.equal(failed.length, 0, `Failed: ${failed.join('; ')}`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
