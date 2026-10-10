
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/jwt';
import prisma from '@/lib/prisma';
import { shouldUseSecureCookies } from '@/lib/cookie';
import { verifyCsrf } from '@/lib/csrf';
import { logAudit, auditRequestContext } from '@/lib/audit';
import { withApiErrorHandling } from '@/lib/api-handler';

const JWT_SECRET = process.env.JWT_SECRET;

export const POST = withApiErrorHandling(async function POST(req: NextRequest) {
  try {
    if (!verifyCsrf(req)) {
      return NextResponse.json({ message: 'Invalid CSRF token.' }, { status: 403 });
    }

    const cookieStore = await cookies();
    // `refresh_token` is path-scoped to /api/auth/refresh so it is NOT sent
    // here; `auth_token` (path "/") is. Resolve the session id from whichever
    // token we actually have. The signature is always verified; only expiry is
    // ignored, so an expired access token can still end its own session.
    const authToken = cookieStore.get('auth_token')?.value;
    const refreshToken = cookieStore.get('refresh_token')?.value;

    let userId: string | undefined;
    let sessionId: string | undefined;

    if (JWT_SECRET) {
      for (const token of [authToken, refreshToken]) {
        if (!token) continue;
        let claims: any;
        try {
          claims = verifyJwt(token, JWT_SECRET, { ignoreExpiration: true });
        } catch {
          continue;
        }
        if (claims?.userId && claims?.sessionId) {
          userId = claims.userId;
          sessionId = claims.sessionId;
          break;
        }
      }
    }

    if (userId && sessionId) {
      await prisma.session.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await logAudit({
        action: 'auth.logout',
        actorType: 'user',
        actorId: userId,
        targetType: 'session',
        targetId: sessionId,
        ...auditRequestContext(req),
      });
    }

    const response = NextResponse.json({ message: 'Logout successful.' }, { status: 200 });
    const secure = shouldUseSecureCookies();

    // Clear cookies by setting an expired date
    response.cookies.set('auth_token', '', { httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: -1 });
    response.cookies.set('refresh_token', '', { httpOnly: true, secure, sameSite: 'strict', path: '/api/auth/refresh', maxAge: -1 });
    
    return response;
  } catch (error) {
    console.error('[LOGOUT_ERROR]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
});
