
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getCurrentSuperAdmin } from '@/lib/super-admin-auth';
import { hasSpecialCharacter } from '@/lib/utils';
import { validatePasswordAgainstBreaches } from '@/lib/password-policy';
import { checkIpLockout, getClientIp, recordIpFailure, resetIpFailures } from '@/lib/rate-limit';
import { shouldUseSecureCookies } from '@/lib/cookie';
import { verifyCsrf } from '@/lib/csrf';
import { logAudit, auditRequestContext } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    if (!verifyCsrf(req)) {
      return NextResponse.json({ errors: ['Invalid CSRF token.'] }, { status: 403 });
    }

    const currentSuperAdmin = await getCurrentSuperAdmin();
    if (!currentSuperAdmin) {
      return NextResponse.json({ errors: ['Not authenticated.'] }, { status: 401 });
    }

    const ip = `super-admin-change-password:${getClientIp(req)}`;
    const ipLock = await checkIpLockout(ip);
    if (ipLock.locked) {
      return NextResponse.json(
        { errors: [`Too many attempts. Please try again in ${ipLock.timeLeftSeconds} seconds.`] },
        { status: 429 }
      );
    }

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      await recordIpFailure(ip, { maxAttempts: 15, lockoutSeconds: 300 });
      return NextResponse.json({ errors: ['All fields are required.'] }, { status: 400 });
    }

    const superAdmin = await prisma.superAdmin.findUnique({
      where: { id: currentSuperAdmin.id },
    });

    if (!superAdmin) {
      return NextResponse.json({ errors: ['Account not found.'] }, { status: 404 });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, superAdmin.password);

    if (!isPasswordValid) {
      await recordIpFailure(ip, { maxAttempts: 15, lockoutSeconds: 300 });
      return NextResponse.json({ errors: ['Incorrect current password.'] }, { status: 400 });
    }

    // Server-side enforcement for new password complexity (mirror client rules)
    if (newPassword.length < 8
        || !/[a-z]/.test(newPassword)
        || !/[A-Z]/.test(newPassword)
        || !/[0-9]/.test(newPassword)
        || !hasSpecialCharacter(newPassword)) {
      await recordIpFailure(ip, { maxAttempts: 15, lockoutSeconds: 300 });
      return NextResponse.json({ errors: ['New password does not meet complexity requirements.'] }, { status: 400 });
    }

    const breachCheck = await validatePasswordAgainstBreaches(newPassword);
    if (!breachCheck.ok && breachCheck.code !== 'POLICY_DISABLED') {
      await recordIpFailure(ip, { maxAttempts: 15, lockoutSeconds: 300 });
      return NextResponse.json({ errors: [breachCheck.reason] }, { status: 400 });
    }

    const newHashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.superAdmin.update({
      where: { id: superAdmin.id },
      data: {
        password: newHashedPassword,
        passwordChangeRequired: false,
        // Invalidate every access token issued before this change.
        tokenVersion: { increment: 1 },
      },
    });

    // Revoke all active sessions for this Super Admin so they must re-authenticate.
    await prisma.superAdminSession.updateMany({
      where: { superAdminId: superAdmin.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await logAudit({
      action: 'superadmin.password.change',
      severity: 'critical',
      actorType: 'superAdmin',
      actorId: superAdmin.id,
      actorLabel: superAdmin.phoneNumber,
      detail: { sessionsRevoked: true },
      ...auditRequestContext(req),
    });

    await resetIpFailures(ip);

    // Clear the session cookie upon successful password change to force re-login
    const response = NextResponse.json({ success: true, message: 'Password updated successfully. Please log in again.' }, { status: 200 });
    response.cookies.set('super_admin_token', '', {
      httpOnly: true,
      secure: shouldUseSecureCookies(),
      sameSite: 'strict',
      path: '/',
      maxAge: -1,
    });

    return response;

  } catch (error) {
    console.error('[SUPER_ADMIN_CHANGE_PASSWORD_ERROR]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
