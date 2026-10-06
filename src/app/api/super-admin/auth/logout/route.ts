
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';
import { shouldUseSecureCookies } from '@/lib/cookie';
import { verifyCsrf } from '@/lib/csrf';
import { logAudit, auditRequestContext } from '@/lib/audit';

const SUPER_ADMIN_JWT_SECRET = process.env.SUPER_ADMIN_JWT_SECRET;

export async function POST(req: NextRequest) {
  if (!verifyCsrf(req)) {
    return NextResponse.json({ message: 'Invalid CSRF token.' }, { status: 403 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('super_admin_token')?.value;

  // Revoke the server-side session so the token cannot be replayed.
  if (token && SUPER_ADMIN_JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, SUPER_ADMIN_JWT_SECRET) as { sessionId?: string; superAdminId?: string };
      if (decoded.sessionId) {
        await prisma.superAdminSession.updateMany({
          where: { id: decoded.sessionId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await logAudit({
          action: 'superadmin.logout',
          actorType: 'superAdmin',
          actorId: decoded.superAdminId ?? null,
          targetType: 'superAdminSession',
          targetId: decoded.sessionId,
          ...auditRequestContext(req),
        });
      }
    } catch {
      // Token invalid/expired — nothing to revoke server-side; still clear the cookie.
    }
  }

  const response = NextResponse.json({ message: 'Logout successful.' }, { status: 200 });

  response.cookies.set('super_admin_token', '', {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: 'strict',
    path: '/',
    maxAge: -1,
  });

  return response;
}
