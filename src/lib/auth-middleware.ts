
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import type { Role, User } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET;

interface VerifiedUser extends User {
  role: Role;
}

/**
 * Verifies the authentication token from the request cookies and returns the user if valid.
 * This is the centralized authority for session validation.
 * It checks:
 * 1. Token existence and signature validity.
 * 2. Session Binding: IP address and User-Agent must match the ones from login.
 * 3. Token Version: Ensures the token hasn't been revoked by a password change.
 *
 * @param req The NextRequest object to access headers and cookies.
 * @returns The full user object if the session is valid, otherwise null.
 */
export async function verifyAuth(req: NextRequest): Promise<VerifiedUser | null> {
  if (!JWT_SECRET) {
    console.error('JWT_SECRET environment variable is not set.');
    return null;
  }

  const token = req.cookies.get('auth_token')?.value;
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      isGuest?: boolean;
      phoneNumber?: string;
      ip?: string;
      userAgent?: string;
      tokenVersion?: number;
    };

    if (!decoded.userId) {
      return null;
    }
    
    // --- Guest User Handling (Simplified) ---
    if (decoded.isGuest) {
      // For this prototype, we'll return a mock guest user object.
      // A real implementation might have more robust guest handling.
       const guestUser: VerifiedUser = {
        id: decoded.userId,
        firstName: 'Guest',
        lastName: 'User',
        phoneNumber: decoded.phoneNumber || '',
        email: '',
        password: '',
        roleId: 'guest-role',
        branchId: null,
        nibBankAccount: null,
        status: 'ACTIVE',
        passwordChangeRequired: false,
        tokenVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        organizerId: null,
        role: {
          id: 'guest-role',
          name: 'Guest',
          description: 'Guest user',
          permissions: '[]',
        },
      };
      return guestUser;
    }


    // --- Full User Validation ---
    
    // 1. Session Binding Verification
    const currentIp = req.ip ?? req.headers.get('x-forwarded-for') ?? '127.0.0.1';
    const currentUserAgent = req.headers.get('user-agent') ?? '';

    if (decoded.ip !== currentIp || decoded.userAgent !== currentUserAgent) {
      console.warn(`Session binding check failed for user ${decoded.userId}.`);
      return null;
    }

    // 2. Fetch user and check token version
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { role: true },
    });

    if (!user) {
      return null;
    }

    // 3. Token Version Verification
    if (user.tokenVersion !== decoded.tokenVersion) {
      console.warn(`Token revocation check failed for user ${user.id}.`);
      return null;
    }

    return user;

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      console.log('Invalid JWT:', error.message);
    } else {
      console.error('An unexpected error occurred during auth verification:', error);
    }
    return null;
  }
}


// These functions are no longer used in middleware but can be adapted for server components if needed.
type AuthenticatedRequestHandler = (req: NextRequest, user: VerifiedUser) => Promise<NextResponse>;

export function requireAuth(handler: AuthenticatedRequestHandler) {
    return async (req: NextRequest) => {
        const user = await verifyAuth(req);
        if (!user) {
            return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
        }
        return handler(req, user);
    };
}

export function requirePermission(permission: string) {
    return function(handler: AuthenticatedRequestHandler) {
        return requireAuth(async (req: NextRequest, user: VerifiedUser) => {
            if (user.role.name === 'Admin') {
                return handler(req, user);
            }
            
            try {
                const permissions: string[] = JSON.parse(user.role.permissions);
                if (permissions.includes(permission)) {
                    return handler(req, user);
                }
            } catch (e) {
                console.error("Failed to parse permissions for user:", user.id);
            }

            return NextResponse.json({ message: 'Permission denied.' }, { status: 403 });
        });
    };
}
