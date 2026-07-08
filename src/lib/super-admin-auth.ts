'use server';

import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';
import { hasPermission } from '@/lib/permissions';
import type { SuperAdmin, Role } from '@prisma/client';

const SUPER_ADMIN_JWT_SECRET = process.env.SUPER_ADMIN_JWT_SECRET;

interface DecodedSuperAdminToken {
  superAdminId: string;
  type?: string;
}

// Definitive server-side session lookup for the Super Admin Portal.
// SuperAdmin has its own identity/session (separate cookie, separate JWT
// secret) but its access is governed by the SAME Role/Permission/RolePermission
// tables the Admin Portal uses, via a reserved "Super Admin" Role.
export async function getCurrentSuperAdmin(): Promise<
  (Omit<SuperAdmin, 'password'> & { role: Role & { permissions: string[] } }) | null
> {
  const cookieStore = await cookies();
  const token = cookieStore.get('super_admin_token')?.value;

  if (!token || !SUPER_ADMIN_JWT_SECRET) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, SUPER_ADMIN_JWT_SECRET) as DecodedSuperAdminToken;

    if (decoded.type !== 'super_admin_access' || !decoded.superAdminId) {
      return null;
    }

    const superAdmin = await prisma.superAdmin.findUnique({
      where: { id: decoded.superAdminId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!superAdmin || superAdmin.status !== 'ACTIVE') {
      return null;
    }

    const permissions = superAdmin.role.rolePermissions.map((rp) => rp.permission.name);
    const { password: _password, ...superAdminWithoutPassword } = superAdmin;

    return {
      ...superAdminWithoutPassword,
      role: {
        ...superAdmin.role,
        permissions,
      },
    } as unknown as Omit<SuperAdmin, 'password'> & { role: Role & { permissions: string[] } };
  } catch (error) {
    console.error('Error in getCurrentSuperAdmin:', error);
    return null;
  }
}

export async function requireSuperAdmin() {
  const superAdmin = await getCurrentSuperAdmin();
  if (!superAdmin) {
    throw new Error('Not authenticated.');
  }
  return superAdmin;
}

export async function requireSuperAdminPermission(permission: string) {
  const superAdmin = await requireSuperAdmin();
  if (!hasPermission(superAdmin.role, permission)) {
    throw new Error('Permission denied.');
  }
  return superAdmin;
}
