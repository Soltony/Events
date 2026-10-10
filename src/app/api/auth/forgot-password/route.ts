import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { sendTempPassword } from '@/lib/email';
import { checkIpLockout, recordIpFailure } from '@/lib/rate-limit';
import { verifyCsrf } from '@/lib/csrf';
import { logAudit, auditRequestContext } from '@/lib/audit';
import { malformedJsonResponse, readJsonBody, withApiErrorHandling } from '@/lib/api-handler';

export const POST = withApiErrorHandling(async function POST(request: NextRequest) {
  try {
    if (!verifyCsrf(request)) {
      return NextResponse.json({ ok: false, message: 'Invalid CSRF token.' }, { status: 403 });
    }

    // Basic IP throttling (best-effort; Request doesn't expose req.ip reliably)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    const ipLock = await checkIpLockout(ip);
    if (ipLock.locked) {
      return NextResponse.json(
        { ok: false, message: `Too many attempts. Please try again in ${ipLock.timeLeftSeconds} seconds.` },
        { status: 429 }
      );
    }

    const body = await readJsonBody(request);
    if (!body) return malformedJsonResponse();
    const email = body?.email?.toString().trim().toLowerCase();

    if (!email) {
      await recordIpFailure(ip, { maxAttempts: 10, lockoutSeconds: 300 });
      return NextResponse.json({ ok: false, message: 'Email is required.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });

    // If no user found, don't reveal that — respond with a generic message
    if (!user) {
      await recordIpFailure(ip, { maxAttempts: 10, lockoutSeconds: 300 });
      return NextResponse.json({ ok: true, message: 'If an admin account exists for that email, a temporary password will be sent.' });
    }

    // Only allow admin accounts to use this flow
    const roleName = user.role?.name || '';
    if (roleName.toLowerCase() !== 'admin') {
      await recordIpFailure(ip, { maxAttempts: 10, lockoutSeconds: 300 });
      return NextResponse.json({ ok: false, message: 'Password reset is not allowed for this role. Contact the administrator for assistance.' }, { status: 403 });
    }

    // Generate temporary password and update the user
    const tempPassword = nanoid(12);
    const hashed = await bcrypt.hash(tempPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        passwordUpdatedAt: new Date(),
        passwordChangeRequired: true,
        tokenVersion: { increment: 1 },
      },
    });

    await logAudit({
      action: 'auth.password.reset_issued',
      severity: 'warning',
      actorType: 'anonymous',
      targetType: 'user',
      targetId: user.id,
      actorLabel: user.email,
      detail: { role: roleName, viaTempPassword: true },
      ...auditRequestContext(request),
    });

    // Send temporary password email
    if (user.email) {
      const mail = await sendTempPassword({ email: user.email, phoneNumber: user.phoneNumber || '', tempPassword });
      if (!mail.success) {
        return NextResponse.json({ ok: false, message: 'Password reset succeeded but failed to send email.' }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, message: 'Temporary password sent to the admin email address.' });
  } catch (err) {
    console.error('Error in admin forgot-password route:', err);
    return NextResponse.json({ ok: false, message: 'Internal server error.' }, { status: 500 });
  }
});
