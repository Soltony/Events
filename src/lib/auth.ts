'use server';

import { cookies } from 'next/headers';
import prisma from './prisma';
import type { Role, User, Branch, District } from '@prisma/client';
import { verifyJwt } from '@/lib/jwt';
import {
  getUserIdleTimeoutSeconds,
  getUserSessionAbsoluteMaxAgeSeconds,
  SESSION_TOUCH_THROTTLE_MS,
} from './session';

const JWT_SECRET = process.env.JWT_SECRET;

// Helper to ensure data is serializable for Client Components
const serialize = (data: any) => {
    if (!data) return null;
    return JSON.parse(JSON.stringify(data, (key, value) =>
        typeof value === 'bigint'
            ? value.toString()
            : value
    ));
}

// This is the definitive server-side function to get the current user's session.
export async function getCurrentUser(): Promise<(User & { role: Role & { permissions: string[] }; branch: (Branch & { district: District }) | null }) | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token || !JWT_SECRET) {
    return null;
  }

  try {
    const decoded = verifyJwt(token, JWT_SECRET) as {
      userId: string;
      tokenVersion?: number;
      sessionId?: string;
      isGuest?: boolean;
    };

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
        },
        branch: {
          include: {
            district: true
          }
        }
      },
    });

    if (!user || user.tokenVersion !== decoded.tokenVersion) {
      return null;
    }

    // Validate the server-side session: it must exist, be unrevoked, and be
    // within the idle + absolute lifetime windows. (Guests carry no session.)
    if (!decoded.isGuest) {
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
      if (idleMs > SESSION_TOUCH_THROTTLE_MS) {
        prisma.session
          .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
          .catch(() => {});
      }
    }
    
    const permissions = user.role.rolePermissions.map(p => p.permission.name);
    
    const { password: _password, ...userWithoutPassword } = user;

    const userWithPermissions = {
      ...userWithoutPassword,
      role: {
        ...user.role,
        permissions: permissions
      }
    };

    return serialize(userWithPermissions);
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    return null;
  }
}
