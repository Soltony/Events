

'use server';

import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import type { Role, User, Permission, RolePermission } from '@prisma/client';
import {
  getUserIdleTimeoutSeconds,
  getUserSessionAbsoluteMaxAgeSeconds,
  SESSION_TOUCH_THROTTLE_MS,
} from '@/lib/session';

const JWT_SECRET = process.env.JWT_SECRET;

interface VerifiedUser extends User {
  // Prisma Role.permissions is stored as a string/JSON in DB, but for app authorization we
  // normalize it into a string[] (permission names).
  role: Omit<Role, 'permissions'> & { permissions: string[] };
  isGuest?: boolean;
}

interface DecodedToken {
    userId: string;
    isGuest?: boolean;
    phoneNumber?: string;
    tokenVersion?: number;
    sessionId?: string;
  type?: 'access' | 'refresh';
}


export async function verifyAuth(req: NextRequest): Promise<VerifiedUser | null> {
  if (!JWT_SECRET) {
    console.error('JWT_SECRET environment variable is not set.');
    return null;
  }

  // Get token from HttpOnly cookie
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;

    const tokenType = (decoded as any).type;
    // Some legacy/internal tokens may not set `type`. Treat missing type as access.
    if (tokenType && tokenType !== 'access') {
      console.warn('Attempted to use non-access token for authentication.');
      return null;
    }

    if (!decoded.userId) {
      return null;
    }

    // Guest users don't need DB validation, just a valid token.
    if (decoded.isGuest) {
      return {
        id: decoded.userId,
        firstName: 'Guest',
        lastName: 'User',
        phoneNumber: decoded.phoneNumber || '',
        email: '',
        password: '',
        passwordUpdatedAt: null,
        failedLoginAttempts: 0,
        lockoutUntil: null,
        roleId: 'guest-role',
        branchId: null,
        nibBankAccount: null,
        status: 'ACTIVE',
        rejectionReason: null,
        passwordChangeRequired: false,
        tokenVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: null,
        createdBySuperAdminId: null,
        isGuest: true,
        role: {
          id: 'guest-role',
          name: 'Guest',
          description: 'Guest user',
          permissions: [],
        },
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { 
          role: { 
              include: { 
                  rolePermissions: {
                      include: {
                          permission: true
                      }
                  }
              }
          }
      },
    });

    if (!user) {
      return null;
    }

    // 🔥 This is the critical token revocation check
    if (user.tokenVersion !== decoded.tokenVersion) {
      console.warn(`Token revocation check failed for user ${user.id}.`);
      return null;
    }

    // Session revocation / concurrency control
    if (!decoded.sessionId) {
      return null;
    }
    const session = await prisma.session.findFirst({
      where: { id: decoded.sessionId, userId: user.id, revokedAt: null },
      select: { id: true, createdAt: true, lastUsedAt: true },
    });
    if (!session) {
      return null;
    }

    // Server-side idle timeout + absolute session lifetime.
    const nowMs = Date.now();
    const idleMs = nowMs - session.lastUsedAt.getTime();
    const ageMs = nowMs - session.createdAt.getTime();
    if (
      idleMs > getUserIdleTimeoutSeconds() * 1000 ||
      ageMs > getUserSessionAbsoluteMaxAgeSeconds() * 1000
    ) {
      await prisma.session
        .updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: new Date() } })
        .catch(() => {});
      return null;
    }
    // Throttled activity bump so the idle window tracks real usage.
    if (idleMs > SESSION_TOUCH_THROTTLE_MS) {
      prisma.session
        .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
        .catch(() => {});
    }

    // Transform permissions into a simple string array for the user object
    const permissions = user.role.rolePermissions.map(rp => rp.permission.name);
    
    // Create the final user object to be returned
    const finalUser: VerifiedUser = {
        ...user,
        role: {
            ...user.role,
            permissions: permissions
        }
    };


    return finalUser;

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      console.log('Invalid or expired JWT:', error.message);
    } else {
      console.error('An unexpected error occurred during auth verification:', error);
    }
    return null;
  }
}
