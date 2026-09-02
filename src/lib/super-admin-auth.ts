'use server';

import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';
import { hasPermission } from '@/lib/permissions';
import { getCurrentUser } from '@/lib/auth';
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

interface AdminPortalActor {
  id: string;
  role: Role & { permissions: string[] };
}

// Resolves the acting identity for the shared admin-portal action layer
// (src/lib/super-admin-user-actions.ts, super-admin-actions.ts). Tries a
// SuperAdmin session first, then falls back to a regular User session — both
// share the same Role/Permission/RolePermission tables, so a User whose Role
// carries the right permission string is just as valid an actor here as a
// SuperAdmin. Callers only ever read `.id` and `.role` off the result (verified
// across both action files — narrowed to that shape here).
async function getCurrentAdminActor(): Promise<AdminPortalActor | null> {
  const superAdmin = await getCurrentSuperAdmin();
  if (superAdmin) {
    return superAdmin;
  }
  return getCurrentUser();
}

export async function requireSuperAdminPermission(permission: string | string[]) {
  const actor = await getCurrentAdminActor();
  if (!actor) {
    throw new Error('Not authenticated.');
  }
  const permissions = Array.isArray(permission) ? permission : [permission];
  if (!permissions.some((p) => hasPermission(actor.role, p))) {
    throw new Error('Permission denied.');
  }
  return actor;
}

// Non-throwing capability check for the shared admin-portal UI (e.g. deciding
// whether to render a "Review" shortcut on the Users list) — unlike
// requireSuperAdminPermission, an unauthenticated or under-permissioned actor
// just gets `false` rather than an error.
export async function currentActorHasPermission(permission: string): Promise<boolean> {
  const actor = await getCurrentAdminActor();
  if (!actor) {
    return false;
  }
  return hasPermission(actor.role, permission);
}
