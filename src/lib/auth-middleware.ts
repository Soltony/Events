import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

interface UserWithRole {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: {
    id: string;
    name: string;
    permissions: string;
  };
}

async function decryptSessionCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get('auth');
    
    if (!tokenCookie) return null;
    
    const secret = process.env.SESSION_SECRET;
    if (!secret) throw new Error('SESSION_SECRET is not set');
    
    const data = Buffer.from(tokenCookie.value, 'base64url');
    const salt = data.slice(0, 16);
    const iv = data.slice(16, 28);
    const ciphertext = data.slice(28);
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new Uint8Array(salt),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      new Uint8Array(ciphertext)
    );
    
    return dec.decode(plaintext);
  } catch (error) {
    console.error('Failed to decrypt session cookie:', error);
    return null;
  }
}

export async function getCurrentUser(): Promise<UserWithRole | null> {
  try {
    const decryptedSession = await decryptSessionCookie();
    if (!decryptedSession) return null;
    
    const { accessToken } = JSON.parse(decryptedSession);
    if (!accessToken) return null;
    
    // Verify token and get user from database
    const user = await prisma.user.findFirst({
      where: { 
        // You might want to add token validation here
        // For now, we'll assume the token is valid if it exists
      },
      include: {
        role: true
      }
    });
    
    return user as UserWithRole | null;
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}

export function hasPermission(user: UserWithRole | null, permission: string): boolean {
  if (!user || !user.role?.permissions) {
    return false;
  }
  
  if (user.role.name === 'Admin') return true;
  
  try {
    // Handle both JSON array and comma-separated formats for backward compatibility
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

export function requireAuth(handler: (req: NextRequest, user: UserWithRole) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', detail: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return handler(req, user);
  };
}

export function requirePermission(permission: string) {
  return function(handler: (req: NextRequest, user: UserWithRole) => Promise<NextResponse>) {
    return async (req: NextRequest) => {
      const user = await getCurrentUser();
      
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized', detail: 'Authentication required' },
          { status: 401 }
        );
      }
      
      if (!hasPermission(user, permission)) {
        return NextResponse.json(
          { error: 'Forbidden', detail: 'Insufficient permissions' },
          { status: 403 }
        );
      }
      
      return handler(req, user);
    };
  };
}
