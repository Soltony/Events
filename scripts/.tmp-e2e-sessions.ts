// TEMPORARY (smoke test helper, delete after use). Creates / revokes short-lived sessions.
//   npx tsx scripts/.tmp-e2e-sessions.ts create <out.json>
//   npx tsx scripts/.tmp-e2e-sessions.ts revoke <out.json>
import 'dotenv/config';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { hashRefreshToken } from '../src/lib/session';

const prisma = new PrismaClient();
const [mode, out] = process.argv.slice(2);

async function create() {
  const sa = await prisma.superAdmin.findFirstOrThrow({ where: { status: 'ACTIVE' } });
  const user = await prisma.user.findFirstOrThrow({ where: { status: 'ACTIVE', role: { name: 'Admin' } } });

  const saSessionId = randomUUID();
  const saToken = jwt.sign({ superAdminId: sa.id, type: 'super_admin_access', tokenVersion: sa.tokenVersion, sessionId: saSessionId }, process.env.SUPER_ADMIN_JWT_SECRET!, { algorithm: 'HS256', expiresIn: 3600 });
  await prisma.superAdminSession.create({ data: { id: saSessionId, superAdminId: sa.id, tokenHash: hashRefreshToken(saToken), userAgent: 'e2e-smoke' } });

  const sessionId = randomUUID();
  const base = { userId: user.id, tokenVersion: user.tokenVersion, sessionId };
  const access = jwt.sign({ ...base, type: 'access' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: 3600 });
  const refresh = jwt.sign({ ...base, type: 'refresh' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: 3600 });
  const nowSec = Math.floor(Date.now() / 1000);
  const expiredAccess = jwt.sign({ ...base, type: 'access', iat: nowSec - 1200, exp: nowSec - 300 }, process.env.JWT_SECRET!, { algorithm: 'HS256' });
  await prisma.session.create({ data: { id: sessionId, userId: user.id, refreshTokenHash: hashRefreshToken(refresh), userAgent: 'e2e-smoke' } });

  const event = await prisma.event.findFirst({ select: { id: true } });
  const role = await prisma.role.findFirst({ where: { name: { not: 'Admin' } }, select: { id: true } }) ?? await prisma.role.findFirst({ select: { id: true } });
  const otherUser = await prisma.user.findFirst({ where: { id: { not: user.id } }, select: { id: true } }) ?? { id: user.id };
  const ticket = await prisma.attendee.findFirst({ select: { id: true } }).catch(() => null);

  fs.writeFileSync(out, JSON.stringify({
    saSessionId, sessionId, saToken, access, refresh, expiredAccess,
    ids: { event: event?.id ?? null, role: role?.id ?? null, user: otherUser.id, ticket: ticket?.id ?? null },
  }, null, 2));
  console.log('created; ids:', JSON.stringify({ event: event?.id, role: role?.id, user: otherUser.id, ticket: ticket?.id }));
}

async function revoke() {
  const s = JSON.parse(fs.readFileSync(out, 'utf8'));
  await prisma.superAdminSession.updateMany({ where: { id: s.saSessionId }, data: { revokedAt: new Date() } });
  await prisma.session.updateMany({ where: { id: s.sessionId }, data: { revokedAt: new Date() } });
  console.log('revoked');
}

(mode === 'create' ? create() : revoke()).catch((e) => { console.error(e.message ?? e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
