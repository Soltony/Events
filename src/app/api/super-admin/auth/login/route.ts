
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signJwt } from '@/lib/jwt';
import crypto from 'crypto';
import { shouldUseSecureCookies } from '@/lib/cookie';
import { normalizeEthiopianPhoneStrict } from '@/lib/utils';
import { verifyCsrf } from '@/lib/csrf';
import { toPublicSuperAdmin } from '@/lib/public-profile';
import { logAudit, auditRequestContext } from '@/lib/audit';
import { getMaxActiveSuperAdminSessions, hashRefreshToken } from '@/lib/session';
import {
  checkIpLockout,
  checkSuperAdminLockout,
  getClientIp,
  recordIpFailure,
  recordSuperAdminFailure,
  resetIpFailures,
  resetSuperAdminFailures,
} from '@/lib/rate-limit';
import { malformedJsonResponse, readJsonBody, withApiErrorHandling } from '@/lib/api-handler';

const SUPER_ADMIN_JWT_SECRET = process.env.SUPER_ADMIN_JWT_SECRET;

// Absolute session lifetime for the Super Admin portal (default 8h). Inactivity
// is capped separately by SUPER_ADMIN_IDLE_TIMEOUT_SECONDS in super-admin-auth.ts.
function getSessionMaxAgeSeconds() {
  const n = Number(process.env.SUPER_ADMIN_SESSION_MAX_AGE_SECONDS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 60 * 60 * 8;
}

export const POST = withApiErrorHandling(async function POST(req: NextRequest) {
  try {
    if (!SUPER_ADMIN_JWT_SECRET) {
      throw new Error('SUPER_ADMIN_JWT_SECRET environment variable is not set.');
    }

    if (!verifyCsrf(req)) {
      return NextResponse.json({ message: 'Invalid CSRF token.' }, { status: 403 });
    }

    const ip = `super-admin:${getClientIp(req)}`;
    const ipLock = await checkIpLockout(ip);
    if (ipLock.locked) {
      return NextResponse.json(
        { message: `Too many attempts. Please try again in ${ipLock.timeLeftSeconds} seconds.` },
        { status: 429 }
      );
    }

    const body = await readJsonBody(req);
    if (!body) return malformedJsonResponse();
    const { phoneNumber, password } = body;

    if (!phoneNumber || !password) {
      return NextResponse.json({ message: 'Phone number and password are required.' }, { status: 400 });
    }

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizeEthiopianPhoneStrict(phoneNumber);
    } catch (e: any) {
      return NextResponse.json({ message: e?.message || 'Invalid phone number.' }, { status: 400 });
    }

    const superAdmin = await prisma.superAdmin.findUnique({
      where: { phoneNumber: normalizedPhone },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!superAdmin || !superAdmin.password) {
      await recordIpFailure(ip, { maxAttempts: 10, lockoutSeconds: 60 });
      return NextResponse.json({ message: 'Invalid credentials.' }, { status: 401 });
    }

    // Per-account lockout (independent of the IP throttle).
    const accountLock = await checkSuperAdminLockout(superAdmin);
    if (accountLock.locked) {
      return NextResponse.json(
        { message: `Account temporarily locked. Please try again in ${accountLock.timeLeftSeconds} seconds.` },
        { status: 429 }
      );
    }

    if (superAdmin.status !== 'ACTIVE') {
      await recordIpFailure(ip, { maxAttempts: 10, lockoutSeconds: 60 });
      await recordSuperAdminFailure(superAdmin.id);
      return NextResponse.json({ message: 'Invalid credentials.' }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, superAdmin.password);

    if (!isPasswordValid) {
      await recordIpFailure(ip, { maxAttempts: 10, lockoutSeconds: 60 });
      await recordSuperAdminFailure(superAdmin.id);
      await logAudit({
        action: 'superadmin.login.failure',
        severity: 'warning',
        actorType: 'superAdmin',
        actorId: superAdmin.id,
        actorLabel: superAdmin.phoneNumber,
        detail: { reason: 'bad_password' },
        ...auditRequestContext(req),
      });
      return NextResponse.json({ message: 'Invalid credentials.' }, { status: 401 });
    }

    await resetIpFailures(ip);
    await resetSuperAdminFailures(superAdmin.id);

    // Invalidate any access tokens minted before this login.
    const { tokenVersion } = await prisma.superAdmin.update({
      where: { id: superAdmin.id },
      data: { tokenVersion: { increment: 1 }, lastLoginAt: new Date() },
      select: { tokenVersion: true },
    });

    const sessionId = crypto.randomUUID();
    const sessionMaxAge = getSessionMaxAgeSeconds();

    const token = signJwt(
      {
        superAdminId: superAdmin.id,
        type: 'super_admin_access' as const,
        tokenVersion,
        sessionId,
      },
      SUPER_ADMIN_JWT_SECRET,
      { expiresIn: sessionMaxAge }
    );

    // Concurrency control: cap the number of live sessions per Super Admin.
    const maxSessions = getMaxActiveSuperAdminSessions();
    if (maxSessions === 1) {
      await prisma.superAdminSession.updateMany({
        where: { superAdminId: superAdmin.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      const activeSessions = await prisma.superAdminSession.findMany({
        where: { superAdminId: superAdmin.id, revokedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      const overflow = activeSessions.length - (maxSessions - 1);
      if (overflow > 0) {
        await prisma.superAdminSession.updateMany({
          where: { id: { in: activeSessions.slice(0, overflow).map((s) => s.id) } },
          data: { revokedAt: new Date() },
        });
      }
    }

    await prisma.superAdminSession.create({
      data: {
        id: sessionId,
        superAdminId: superAdmin.id,
        tokenHash: hashRefreshToken(token),
        userAgent: req.headers.get('user-agent') || undefined,
        ip: getClientIp(req),
        lastUsedAt: new Date(),
      },
    });

    await logAudit({
      action: 'superadmin.login.success',
      severity: 'warning',
      actorType: 'superAdmin',
      actorId: superAdmin.id,
      actorLabel: superAdmin.phoneNumber,
      targetType: 'superAdminSession',
      targetId: sessionId,
      ...auditRequestContext(req),
    });

    const permissions = superAdmin.role.rolePermissions.map((rp) => rp.permission.name);

    const response = NextResponse.json({
      message: 'Login successful.',
      superAdmin: toPublicSuperAdmin({ ...superAdmin, lastLoginAt: new Date(), permissions }),
    }, { status: 200 });

    response.cookies.set('super_admin_token', token, {
      httpOnly: true,
      secure: shouldUseSecureCookies(),
      sameSite: 'strict',
      path: '/',
      maxAge: sessionMaxAge,
    });

    return response;

  } catch (error: any) {
    console.error('[SUPER_ADMIN_LOGIN_ERROR]', error);
    return NextResponse.json({ message: 'An unexpected error occurred. Please try again.' }, { status: 500 });
  }
});
