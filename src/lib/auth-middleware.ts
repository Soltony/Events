
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import type { Role, User } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET;

interface UserWithRole extends User {
  role: Role;
}

export async function getCurrentUserFromCookie(): Promise<UserWithRole | null> {
    if (!JWT_SECRET) {
      console.error('JWT_SECRET environment variable is not set.');
      return null;
    }

    const token = cookies().get('auth_token')?.value;
    if (!token) {
        return null;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            include: { role: true },
        });

        return user as UserWithRole | null;

    } catch (error) {
        console.error('Error verifying token or fetching user in middleware:', error);
        return null;
    }
}


export function hasPermission(user: UserWithRole | null, permission: string): boolean {
  if (!user || !user.role?.permissions) {
    return false;
  }
  
  if (user.role.name === 'Admin') return true;
  
  try {
    let userPermissions: string[];
    if (user.role.permissions.startsWith('[')) {
      userPermissions = JSON.parse(user.role.permissions);
    } else {
      userPermissions = user.role.permissions.split(',');
    }
    
    return userPermissions.includes(permission);
  } catch (error) {
    console.error('Failed to parse permissions:', error);
    return false;
  }
}

// Higher-order function for requiring authentication
export function requireAuth(handler: (req: NextRequest, user: UserWithRole) => Promise<NextResponse>) {
  return async (req: NextRequest, ...args: any[]) => {
    const user = await getCurrentUserFromCookie();
    
    if (!user) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return handler(req, user);
  };
}

// Higher-order function for requiring specific permissions
export function requirePermission(permission: string | string[]) {
  return function(handler: (req: NextRequest, user: UserWithRole) => Promise<NextResponse>) {
    return async (req: NextRequest, ...args: any[]) => {
      const user = await getCurrentUserFromCookie();
      
      if (!user) {
        return NextResponse.json(
          { message: 'Authentication required' },
          { status: 401 }
        );
      }
      
      const permissionsToCheck = Array.isArray(permission) ? permission : [permission];
      const hasRequiredPermission = permissionsToCheck.some(p => hasPermission(user, p));

      if (!hasRequiredPermission) {
        return NextResponse.json(
          { message: 'Insufficient permissions' },
          { status: 403 }
        );
      }
      
      return handler(req, user);
    };
  };
}
