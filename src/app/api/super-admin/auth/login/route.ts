
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { shouldUseSecureCookies } from '@/lib/cookie';
import { normalizeEthiopianPhoneStrict } from '@/lib/utils';
import {
  checkIpLockout,
  getClientIp,
  recordIpFailure,
  resetIpFailures,
} from '@/lib/rate-limit';

const SUPER_ADMIN_JWT_SECRET = process.env.SUPER_ADMIN_JWT_SECRET;
const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 60 * 60 * 24; // 1 day

export async function POST(req: NextRequest) {
  try {
    if (!SUPER_ADMIN_JWT_SECRET) {
      throw new Error('SUPER_ADMIN_JWT_SECRET environment variable is not set.');
    }

    const ip = `super-admin:${getClientIp(req)}`;
    const ipLock = await checkIpLockout(ip);
    if (ipLock.locked) {
      return NextResponse.json(
        { message: `Too many attempts. Please try again in ${ipLock.timeLeftSeconds} seconds.` },
        { status: 429 }
      );
    }

    const { phoneNumber, password } = await req.json();

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

    if (!superAdmin || !superAdmin.password || superAdmin.status !== 'ACTIVE') {
      await recordIpFailure(ip, { maxAttempts: 10, lockoutSeconds: 60 });
      return NextResponse.json({ message: 'Invalid credentials.' }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, superAdmin.password);

    if (!isPasswordValid) {
      await recordIpFailure(ip, { maxAttempts: 10, lockoutSeconds: 60 });
      return NextResponse.json({ message: 'Invalid credentials.' }, { status: 401 });
    }

    await resetIpFailures(ip);

    await prisma.superAdmin.update({
      where: { id: superAdmin.id },
      data: { lastLoginAt: new Date() },
    });

    const token = jwt.sign(
      { superAdminId: superAdmin.id, type: 'super_admin_access' as const },
      SUPER_ADMIN_JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS }
    );

    const permissions = superAdmin.role.rolePermissions.map((rp) => rp.permission.name);
    const { password: _password, ...superAdminWithoutPassword } = superAdmin;

    const response = NextResponse.json({
      message: 'Login successful.',
      superAdmin: {
        ...superAdminWithoutPassword,
        role: { ...superAdmin.role, permissions },
      },
    }, { status: 200 });

    response.cookies.set('super_admin_token', token, {
      httpOnly: true,
      secure: shouldUseSecureCookies(),
      sameSite: 'strict',
      path: '/',
      maxAge: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
    });

    return response;

  } catch (error: any) {
    console.error('[SUPER_ADMIN_LOGIN_ERROR]', error);
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}
