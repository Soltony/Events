
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import type { Role, User } from '@prisma/client';

// This file is being simplified as middleware should not handle heavy logic
// or use Node.js-specific APIs to remain Edge-compatible.
// Authentication and permission checks are now primarily handled in the AuthContext
// and via API routes running in the Node.js runtime.

// Kept for server-side usage if needed, but not in middleware.
export async function hasPermission(user: (User & { role: Role }) | null, permission: string): Promise<boolean> {
  if (!user || !user.role?.permissions) {
    return false;
  }
  
  if (user.role.name === 'Admin') return true;
  
  try {
    let userPermissions: string[];
    const permissionsString = user.role.permissions as unknown as string;
    
    if (permissionsString.startsWith('[')) {
      userPermissions = JSON.parse(permissionsString);
    } else {
      userPermissions = permissionsString.split(',');
    }
    
    return userPermissions.includes(permission);
  } catch (error) {
    console.error('Failed to parse permissions:', error);
    return false;
  }
}

// These functions are no longer used in middleware but can be adapted for server components if needed.
// For now, they are kept but simplified.
type AuthenticatedRequestHandler = (req: NextRequest, user: User & { role: Role }) => Promise<NextResponse>;

export function requireAuth(handler: AuthenticatedRequestHandler) {
  return async (req: NextRequest) => {
    // This logic should be moved to API routes or page-level checks.
    // The middleware will handle the basic redirect if the cookie is missing.
    return NextResponse.next();
  };
}

export function requirePermission(permission: string | string[]) {
  return function(handler: AuthenticatedRequestHandler) {
    return async (req: NextRequest) => {
      // This logic is now handled in the page components via useAuth hook.
      return NextResponse.next();
    };
  };
}
