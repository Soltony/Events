
'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import type { Role, User, UserStatus, District, Branch } from '@prisma/client';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import cuid from 'cuid';
import { Prisma } from '@prisma/client';
import { normalizeEthiopianPhoneStrict } from '@/lib/utils';
import { sendTempPassword } from '@/lib/email';
import { validatePermissions } from '@/lib/permissions';
import { requireSuperAdminPermission } from '@/lib/super-admin-auth';

const serialize = (data: any) => {
  if (!data) return null;
  return JSON.parse(JSON.stringify(data, (key, value) => (typeof value === 'bigint' ? value.toString() : value)));
};

/**
 * Predefined Access Control Policy for Role Assignment — mirrors src/lib/actions.ts's
 * ROLE_ASSIGNMENT_POLICY, duplicated here since the original is a private helper.
 * Super Admin is exempt from the "Admin role can only be assigned to yourself" rule
 * below, since it has no User.id and is the top trust tier.
 */
async function validateRoleAssignment(newRoleId: string | undefined) {
  if (!newRoleId) return undefined;

  const targetRole = await prisma.role.findUnique({
    where: { id: newRoleId },
    select: { name: true },
  });

  if (!targetRole) {
    throw new Error('Invalid roleId: The specified role does not exist.');
  }
  // The reserved "Super Admin" role is exclusively linked to the one Super Admin
  // account and must never be assignable to a regular Admin Portal user.
  if (targetRole.name === 'Super Admin') {
    throw new Error('The "Super Admin" role is reserved and cannot be assigned to this account.');
  }
  // Otherwise Super Admin may assign any role, including Admin — no further restriction.
  return targetRole;
}

// --- User management ---

export async function getUsersAndRoles() {
  await requireSuperAdminPermission('Users:Read');

  const users = await prisma.user.findMany({
    include: {
      role: true,
      branch: { include: { district: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const roles = await prisma.role.findMany({
    include: {
      rolePermissions: {
        select: { permission: { select: { name: true } } },
      },
    },
  });

  const serializedRoles = roles.map((r) => ({
    ...r,
    permissions: (r.rolePermissions || []).map((p) => p.permission.name),
  }));

  const usersWithoutPasswords = users.map(({ password: _password, ...rest }) => rest);

  return serialize({ users: usersWithoutPasswords, roles: serializedRoles });
}

export async function getUserById(userId: string) {
  await requireSuperAdminPermission('Users:Read');
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  if (!user) return null;
  const { password: _password, ...rest } = user;
  return serialize(rest);
}

export async function getUserByPhoneNumber(phoneNumber: string) {
  await requireSuperAdminPermission('Users:Read');
  let normalizedPhone: string;
  try {
    normalizedPhone = normalizeEthiopianPhoneStrict(phoneNumber);
  } catch (e: any) {
    throw new Error(e?.message || 'Invalid phone number.');
  }
  const user = await prisma.user.findUnique({
    where: { phoneNumber: normalizedPhone },
    include: { role: true },
  });
  if (!user) return null;
  const { password: _password, ...rest } = user;
  return serialize(rest);
}

export async function updateUser(userId: string, data: Partial<User>) {
  await requireSuperAdminPermission('Users:Update');

  const targetUser = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!targetUser) {
    throw new Error('User not found.');
  }

  const { firstName, lastName, phoneNumber, roleId, nibBankAccount, email, branchId } = data;

  const targetRole = await validateRoleAssignment(roleId);

  const normalizedPhoneNumber =
    typeof phoneNumber === 'string' && phoneNumber.trim().length > 0
      ? normalizeEthiopianPhoneStrict(phoneNumber)
      : undefined;

  // Event Organizer Maker-Checker: switching an existing user's role to
  // Organizer, or editing any detail of a user who is (or remains) an
  // Organizer, must (re-)enter the Pending Approval queue exactly like a
  // fresh registration — an edited registration is re-reviewed just like a
  // new one, rather than silently keeping whatever status it already had.
  const becomesOrganizer = !!roleId && roleId !== targetUser.roleId && targetRole?.name === 'Organizer';
  const remainsOrganizer = targetUser.role.name === 'Organizer' && (!roleId || roleId === targetUser.roleId);
  const hasProfileChanges =
    (firstName !== undefined && firstName !== targetUser.firstName) ||
    (lastName !== undefined && lastName !== targetUser.lastName) ||
    (normalizedPhoneNumber !== undefined && normalizedPhoneNumber !== targetUser.phoneNumber) ||
    (email !== undefined && (email || null) !== targetUser.email) ||
    (branchId !== undefined && (branchId || null) !== targetUser.branchId) ||
    (nibBankAccount !== undefined && (nibBankAccount || null) !== targetUser.nibBankAccount);
  const requiresReapproval = becomesOrganizer || (remainsOrganizer && hasProfileChanges);

  let updatedUser;
  try {
    updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName,
        lastName,
        phoneNumber: normalizedPhoneNumber ?? phoneNumber,
        roleId,
        branchId: branchId || null,
        nibBankAccount: nibBankAccount || null,
        email: email || null,
        ...(requiresReapproval
          ? { status: 'PENDING' as UserStatus, rejectionReason: null, tokenVersion: { increment: 1 } }
          : {}),
      },
    });

    if (requiresReapproval) {
      await prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      revalidatePath('/dashboard/organizer-approvals');
      revalidatePath('/super-admin/organizer-approvals');
    }
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const metaTarget = err?.meta?.target;
      if (Array.isArray(metaTarget) && metaTarget.includes('email')) {
        throw new Error('The provided email address is already in use.');
      }
      if (Array.isArray(metaTarget) && metaTarget.includes('phoneNumber')) {
        throw new Error('The provided phone number is already registered.');
      }
      throw new Error('Unique constraint violation.');
    }
    throw err;
  }

  revalidatePath('/super-admin/users');
  revalidatePath(`/super-admin/users/${userId}/edit`);
  return serialize(updatedUser);
}

export async function updateUserRole(userId: string, newRoleId: string) {
  await requireSuperAdminPermission('Users:Update');

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) {
    throw new Error('User not found.');
  }

  const newRole = await validateRoleAssignment(newRoleId);

  // Event Organizer Maker-Checker: switching an existing user's role to
  // Organizer must re-enter the Pending Approval queue exactly like a fresh
  // registration, rather than keeping whatever status they already had.
  const becomesOrganizer = newRoleId !== targetUser.roleId && newRole?.name === 'Organizer';

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      roleId: newRoleId,
      ...(becomesOrganizer ? { status: 'PENDING' as UserStatus, rejectionReason: null } : {}),
    },
  });

  // Privilege update: revoke sessions + bump tokenVersion (kills access tokens)
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
  await prisma.session.updateMany({
    where: { userId: userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  revalidatePath('/super-admin/users');
  const { password: _password, ...rest } = user;
  return serialize(rest);
}

export async function updateUserStatus(userId: string, status: UserStatus) {
  await requireSuperAdminPermission('Users:Update');

  const targetUser = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!targetUser) {
    throw new Error('User not found.');
  }

  // Event Organizer Maker-Checker: the PENDING -> ACTIVE/REJECTED decision is
  // reserved for holders of 'Organizer Approvals:Access' via approveOrganizer/
  // rejectOrganizer (which also reissue credentials and notify the user) —
  // it must not be doable by anyone who merely has Users:Update.
  if (targetUser.role.name === 'Organizer' && (targetUser.status === 'PENDING' || targetUser.status === 'REJECTED')) {
    throw new Error('Event Organizer registrations must be approved or rejected from the Organizer Approvals page.');
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { status },
  });

  // Status change can affect access: revoke sessions + bump tokenVersion
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
  await prisma.session.updateMany({
    where: { userId: userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  revalidatePath('/super-admin/users');
  const { password: _password, ...rest } = user;
  return serialize(rest);
}

export async function deleteUser(userId: string, phoneNumber: string) {
  try {
    await requireSuperAdminPermission('Users:Delete');

    const userToDelete = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!userToDelete) {
      return { ok: false, message: 'User not found.' };
    }

    const count = await prisma.event.count({ where: { organizerId: userId } });
    if (count > 0) {
      return {
        ok: false,
        message: `Cannot delete user. They are the organizer of ${count} event(s). Please delete or reassign the events first.`,
      };
    }

    await prisma.attendee.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });

    revalidatePath('/super-admin/users');
    return { ok: true };
  } catch (err: any) {
    console.error('Error deleting user:', err);
    if (err.code === 'P2003') {
      return {
        ok: false,
        message:
          'Cannot delete user. They are still linked to other records in the database (e.g., as an event organizer). Please reassign or delete those records first.',
      };
    }
    return { ok: false, message: err.message ?? 'Unexpected server error.' };
  }
}

export async function resetUserPassword(userId: string) {
  await requireSuperAdminPermission('Users:Update');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { ok: false, message: 'User not found.' };
  }

  const tempPassword = nanoid(8);
  const hashed = await bcrypt.hash(tempPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashed,
      passwordUpdatedAt: new Date(),
      passwordChangeRequired: true,
      tokenVersion: { increment: 1 },
    },
  });

  try {
    if (user.email) {
      await sendTempPassword({ email: user.email, phoneNumber: user.phoneNumber, tempPassword });
    }
  } catch (err) {
    console.error('Failed to send temporary password email:', err);
    return { ok: false, message: 'Password reset but failed to send email.' };
  }

  revalidatePath('/super-admin/users');
  return { ok: true };
}

export async function addUser(
  data: {
    firstName: string;
    lastName: string;
    phoneNumber: string;
    email: string;
    roleId?: string;
    branchId?: string;
  }
): Promise<{ success: boolean; error?: string; pendingApproval?: boolean }> {
  await requireSuperAdminPermission('Users:Create');

  try {
    let normalizedPhone: string;
    try {
      normalizedPhone = normalizeEthiopianPhoneStrict(data.phoneNumber);
    } catch (e: any) {
      return { success: false, error: e?.message || 'Invalid phone number.' };
    }

    const existingUserByPhone = await prisma.user.findUnique({ where: { phoneNumber: normalizedPhone } });
    if (existingUserByPhone) {
      return { success: false, error: 'Phone number is already registered.' };
    }

    const existingUserByEmail = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUserByEmail) {
      return { success: false, error: 'Email is already registered.' };
    }

    let targetRole;
    try {
      targetRole = await validateRoleAssignment(data.roleId);
    } catch (e: any) {
      return { success: false, error: e?.message || 'Permission denied.' };
    }

    const tempPassword = nanoid(10);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Event Organizer registrations go through Maker-Checker approval: they are
    // created PENDING (blocked from login) and only receive credentials once an
    // approver with Organizer Approvals:Access approves them.
    const isOrganizer = targetRole?.name === 'Organizer';

    const user = await prisma.user.create({
      data: {
        id: cuid(),
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: normalizedPhone,
        email: data.email,
        password: hashedPassword,
        roleId: data.roleId as string,
        branchId: data.branchId || null,
        status: isOrganizer ? 'PENDING' : 'ACTIVE',
        passwordChangeRequired: true,
        tokenVersion: 1,
      },
    });

    if (!isOrganizer) {
      await sendTempPassword({ email: data.email, phoneNumber: normalizedPhone, tempPassword });
    }

    return { success: true, pendingApproval: isOrganizer };
  } catch (error: any) {
    console.error('Failed to add user:', error);
    if (error.code === 'P2002') {
      if (error.meta?.target?.includes('phoneNumber')) {
        return { success: false, error: 'This phone number is already in use.' };
      }
      if (error.meta?.target?.includes('email')) {
        return { success: false, error: 'This email address is already in use.' };
      }
    }
    return { success: false, error: error.message || 'An unexpected error occurred.' };
  }
}

// --- Staff management ---
// Ownership model: every staff member is linked to the admin-portal actor (a User
// with Staff:Create permission, or a SuperAdmin) who registered them via
// createdById / createdBySuperAdminId. Non-Super-Admin actors may only read/update/
// delete the staff they created; Super Admin sees and manages all staff.

export async function getStaff() {
  const actor = await requireSuperAdminPermission('Staff:Read');
  const isSuperAdmin = actor.role.name === 'Super Admin';

  const staff = await prisma.user.findMany({
    where: {
      role: { name: 'Staff' },
      ...(isSuperAdmin ? {} : { createdById: actor.id }),
    },
    include: {
      role: true,
      branch: { include: { district: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const staffWithoutPasswords = staff.map(({ password: _password, ...rest }) => rest);
  return { staff: serialize(staffWithoutPasswords), isSuperAdmin };
}

export async function addStaff(
  data: {
    firstName: string;
    lastName: string;
    phoneNumber: string;
    email: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireSuperAdminPermission('Staff:Create');
  const isSuperAdmin = actor.role.name === 'Super Admin';

  try {
    let normalizedPhone: string;
    try {
      normalizedPhone = normalizeEthiopianPhoneStrict(data.phoneNumber);
    } catch (e: any) {
      return { success: false, error: e?.message || 'Invalid phone number.' };
    }

    const existingUserByPhone = await prisma.user.findUnique({ where: { phoneNumber: normalizedPhone } });
    if (existingUserByPhone) {
      return { success: false, error: 'Phone number is already registered.' };
    }

    const existingUserByEmail = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUserByEmail) {
      return { success: false, error: 'Email is already registered.' };
    }

    const staffRole = await prisma.role.findFirst({ where: { name: 'Staff' } });
    if (!staffRole) {
      return { success: false, error: 'Default role "Staff" not found.' };
    }

    const tempPassword = nanoid(10);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    await prisma.user.create({
      data: {
        id: cuid(),
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: normalizedPhone,
        email: data.email,
        password: hashedPassword,
        roleId: staffRole.id,
        status: 'ACTIVE',
        passwordChangeRequired: true,
        tokenVersion: 1,
        createdById: isSuperAdmin ? null : actor.id,
        createdBySuperAdminId: isSuperAdmin ? actor.id : null,
      },
    });

    await sendTempPassword({ email: data.email, phoneNumber: normalizedPhone, tempPassword });

    revalidatePath('/super-admin/staff');
    revalidatePath('/dashboard/staff');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to add staff:', error);
    if (error.code === 'P2002') {
      if (error.meta?.target?.includes('phoneNumber')) {
        return { success: false, error: 'This phone number is already in use.' };
      }
      if (error.meta?.target?.includes('email')) {
        return { success: false, error: 'This email address is already in use.' };
      }
    }
    return { success: false, error: error.message || 'An unexpected error occurred.' };
  }
}

export async function resetStaffPassword(userId: string) {
  const actor = await requireSuperAdminPermission('Staff:Update');
  const isSuperAdmin = actor.role.name === 'Super Admin';

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!user || user.role.name !== 'Staff') {
    return { ok: false, message: 'Staff member not found.' };
  }
  if (!isSuperAdmin && user.createdById !== actor.id) {
    return { ok: false, message: 'You do not have permission to manage this staff member.' };
  }

  const tempPassword = nanoid(8);
  const hashed = await bcrypt.hash(tempPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashed,
      passwordUpdatedAt: new Date(),
      passwordChangeRequired: true,
      tokenVersion: { increment: 1 },
    },
  });

  try {
    if (user.email) {
      await sendTempPassword({ email: user.email, phoneNumber: user.phoneNumber, tempPassword });
    }
  } catch (err) {
    console.error('Failed to send temporary password email:', err);
    return { ok: false, message: 'Password reset but failed to send email.' };
  }

  revalidatePath('/super-admin/staff');
  revalidatePath('/dashboard/staff');
  return { ok: true };
}

export async function updateStaff(
  userId: string,
  data: { firstName: string; lastName: string; phoneNumber: string; email: string }
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireSuperAdminPermission('Staff:Update');
  const isSuperAdmin = actor.role.name === 'Super Admin';

  const staffToUpdate = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!staffToUpdate || staffToUpdate.role.name !== 'Staff') {
    return { success: false, error: 'Staff member not found.' };
  }
  if (!isSuperAdmin && staffToUpdate.createdById !== actor.id) {
    return { success: false, error: 'You do not have permission to manage this staff member.' };
  }

  let normalizedPhone: string;
  try {
    normalizedPhone = normalizeEthiopianPhoneStrict(data.phoneNumber);
  } catch (e: any) {
    return { success: false, error: e?.message || 'Invalid phone number.' };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: normalizedPhone,
        email: data.email,
      },
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      if (error.meta?.target?.includes('phoneNumber')) {
        return { success: false, error: 'This phone number is already in use.' };
      }
      if (error.meta?.target?.includes('email')) {
        return { success: false, error: 'This email address is already in use.' };
      }
    }
    return { success: false, error: error.message || 'An unexpected error occurred.' };
  }

  revalidatePath('/super-admin/staff');
  revalidatePath('/dashboard/staff');
  return { success: true };
}

export async function updateStaffStatus(userId: string, status: 'ACTIVE' | 'INACTIVE') {
  const actor = await requireSuperAdminPermission('Staff:Update');
  const isSuperAdmin = actor.role.name === 'Super Admin';

  const staffToUpdate = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!staffToUpdate || staffToUpdate.role.name !== 'Staff') {
    return { ok: false, message: 'Staff member not found.' };
  }
  if (!isSuperAdmin && staffToUpdate.createdById !== actor.id) {
    return { ok: false, message: 'You do not have permission to manage this staff member.' };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { status, tokenVersion: { increment: 1 } },
  });

  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  revalidatePath('/super-admin/staff');
  revalidatePath('/dashboard/staff');
  return { ok: true };
}

export async function deleteStaff(userId: string) {
  try {
    const actor = await requireSuperAdminPermission('Staff:Delete');
    const isSuperAdmin = actor.role.name === 'Super Admin';

    const staffToDelete = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!staffToDelete || staffToDelete.role.name !== 'Staff') {
      return { ok: false, message: 'Staff member not found.' };
    }
    if (!isSuperAdmin && staffToDelete.createdById !== actor.id) {
      return { ok: false, message: 'You do not have permission to delete this staff member.' };
    }

    await prisma.attendee.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });

    revalidatePath('/super-admin/staff');
    revalidatePath('/dashboard/staff');
    return { ok: true };
  } catch (err: any) {
    console.error('Error deleting staff member:', err);
    if (err.code === 'P2003') {
      return {
        ok: false,
        message: 'Cannot delete staff member. They are still linked to other records in the database.',
      };
    }
    return { ok: false, message: err.message ?? 'Unexpected server error.' };
  }
}

// --- Role management ---

export async function getRoles() {
  try {
    await requireSuperAdminPermission('Roles:Read');
    const roles = await prisma.role.findMany({ include: { rolePermissions: { include: { permission: true } } } });
    const normalized = roles.map((r) => {
      let perms: string[] = [];
      if (r.rolePermissions && r.rolePermissions.length > 0) {
        perms = r.rolePermissions.map((rp) => rp.permission.name);
      } else if (r.permissions) {
        try {
          const parsed = typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions;
          if (Array.isArray(parsed)) perms = parsed;
        } catch (e) {
          if (typeof r.permissions === 'string') {
            perms = r.permissions.split(',').map((s) => s.trim()).filter(Boolean);
          }
        }
      }
      return { ...r, permissions: perms };
    });
    return serialize(normalized);
  } catch (error: any) {
    console.error('Failed to fetch roles from database:', error);
    throw new Error('Could not load roles. Please check the database connection and try again.');
  }
}

export async function getRoleById(id: string) {
  await requireSuperAdminPermission('Roles:Read');
  const role = await prisma.role.findUnique({
    where: { id },
    include: { rolePermissions: { include: { permission: true } } },
  });

  if (!role) return null;

  let perms: string[] = [];
  if (role.rolePermissions && role.rolePermissions.length > 0) {
    perms = role.rolePermissions.map((rp) => rp.permission.name);
  } else if (role.permissions) {
    try {
      const permissionsString = Array.isArray(role.permissions) ? JSON.stringify(role.permissions) : String(role.permissions);
      const parsed = JSON.parse(permissionsString);
      if (Array.isArray(parsed)) {
        perms = parsed.map(String);
      }
    } catch (e) {
      console.warn(`Failed to parse permissions for role ${id}:`, role.permissions, e);
      if (typeof role.permissions === 'string') {
        perms = role.permissions.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
  }

  const normalized = { ...role, permissions: perms };
  return serialize(normalized);
}

export async function createRole(data: { name: string; description: string; permissions: string[] }) {
  await requireSuperAdminPermission('Roles:Create');
  const { name, description, permissions } = data;
  const normalizedPermissions = Array.isArray(permissions)
    ? Array.from(new Set(permissions.map((p) => String(p ?? '').trim()).filter(Boolean)))
    : [];

  const validation = validatePermissions(normalizedPermissions);
  if (!validation.valid) {
    throw new Error(`Invalid permissions submitted: ${(validation.invalid || []).join(', ')}`);
  }

  const dbPerms = await prisma.permission.findMany({ where: { name: { in: normalizedPermissions } } });
  if (dbPerms.length !== normalizedPermissions.length) {
    const dbPermNames = new Set(dbPerms.map((p) => p.name));
    const missingPerms = normalizedPermissions.filter((p) => !dbPermNames.has(p));
    throw new Error(`Some submitted permissions do not exist in the database: ${missingPerms.join(', ')}`);
  }

  const role = await prisma.role.create({ data: { name, description } });

  if (dbPerms.length > 0) {
    await prisma.rolePermission.createMany({
      data: dbPerms.map((p) => ({ roleId: role.id, permissionId: p.id })),
    });
  }

  revalidatePath('/super-admin/roles');
  revalidatePath('/super-admin/roles/new');
  return serialize(role);
}

export async function updateRole(id: string, data: Partial<Role> & { permissions: string | string[] }) {
  await requireSuperAdminPermission('Roles:Update');

  const existingRole = await prisma.role.findUnique({ where: { id }, select: { name: true } });
  if (existingRole?.name === 'Super Admin' && data.name !== undefined && data.name !== 'Super Admin') {
    throw new Error('The "Super Admin" role is reserved and cannot be renamed.');
  }
  if (existingRole?.name !== 'Super Admin' && data.name === 'Super Admin') {
    throw new Error('The name "Super Admin" is reserved and cannot be used for another role.');
  }

  let permissionsArray: string[];

  if (typeof data.permissions === 'string') {
    try {
      permissionsArray = JSON.parse(data.permissions);
    } catch (e) {
      throw new Error('Invalid permissions format: expected a JSON string array.');
    }
  } else {
    permissionsArray = data.permissions ?? [];
  }

  permissionsArray = Array.isArray(permissionsArray)
    ? Array.from(new Set(permissionsArray.map((p) => String(p ?? '').trim()).filter(Boolean)))
    : [];

  const validation = validatePermissions(permissionsArray);
  if (!validation.valid) {
    throw new Error(`Invalid permissions provided: ${(validation.invalid || []).join(', ')}`);
  }

  const dbPerms = await prisma.permission.findMany({ where: { name: { in: permissionsArray } } });
  if (dbPerms.length !== permissionsArray.length) {
    const dbPermNames = new Set(dbPerms.map((p) => p.name));
    const missingPerms = permissionsArray.filter((p) => !dbPermNames.has(p));
    throw new Error(`Some submitted permissions do not exist in the database: ${missingPerms.join(', ')}`);
  }

  await prisma.role.update({ where: { id }, data: { name: data.name, description: data.description } });
  await prisma.rolePermission.deleteMany({ where: { roleId: id } });

  if (dbPerms.length > 0) {
    await prisma.rolePermission.createMany({
      data: dbPerms.map((p) => ({ roleId: id, permissionId: p.id })),
    });
  }

  const role = await prisma.role.findUnique({ where: { id }, include: { rolePermissions: { include: { permission: true } } } });

  revalidatePath('/super-admin/roles');
  revalidatePath(`/super-admin/roles/${id}/edit`);
  return serialize(role);
}

export async function deleteRole(id: string) {
  await requireSuperAdminPermission('Roles:Delete');

  const existingRole = await prisma.role.findUnique({ where: { id }, select: { name: true } });
  if (existingRole?.name === 'Super Admin') {
    throw new Error('The "Super Admin" role is reserved and cannot be deleted.');
  }

  const usersWithRole = await prisma.user.count({ where: { roleId: id } });
  if (usersWithRole > 0) {
    throw new Error('Cannot delete role. It is assigned to one or more users. Please reassign users before deleting.');
  }
  await prisma.rolePermission.deleteMany({ where: { roleId: id } });
  const role = await prisma.role.delete({ where: { id } });
  revalidatePath('/super-admin/roles');
  return serialize(role);
}

// --- Organization (Branch/District) management ---

// Next.js redacts the message of any error thrown from a Server Action in
// production builds (only a digest reaches the client). These org actions
// return a `{ error }` result instead of throwing so validation messages
// (duplicate names, FK constraints, bad phone numbers) still reach the UI.
export type OrgActionResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

function toOrgActionError(error: unknown, fallback: string): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return 'A record with that name already exists.';
    if (error.code === 'P2003' || error.code === 'P2014') {
      return 'This record is still referenced by other records and cannot be modified.';
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export async function createDistrict(data: { districtName: string; contactPersonName: string; contactPersonPhone: string }): Promise<OrgActionResult<District>> {
  try {
    await requireSuperAdminPermission('Organization:Create');
    const { districtName, ...rest } = data;
    const normalizedPhone = normalizeEthiopianPhoneStrict(rest.contactPersonPhone);
    const district = await prisma.district.create({
      data: {
        name: districtName,
        ...rest,
        contactPersonPhone: normalizedPhone,
      },
    });
    revalidatePath('/super-admin/organization');
    return { data: serialize(district) };
  } catch (error) {
    return { error: toOrgActionError(error, 'Failed to save the district.') };
  }
}

export async function createBranch(data: { branchName: string; districtId: string; contactPersonName: string; contactPersonPhone: string }): Promise<OrgActionResult<Branch>> {
  try {
    await requireSuperAdminPermission('Organization:Create');
    const { branchName, ...rest } = data;
    const normalizedPhone = normalizeEthiopianPhoneStrict(rest.contactPersonPhone);
    const branch = await prisma.branch.create({
      data: {
        name: branchName,
        ...rest,
        contactPersonPhone: normalizedPhone,
      },
    });
    revalidatePath('/super-admin/organization');
    return { data: serialize(branch) };
  } catch (error) {
    return { error: toOrgActionError(error, 'Failed to save the branch.') };
  }
}

export async function updateDistrict(id: string, data: { districtName: string; contactPersonName: string; contactPersonPhone: string }): Promise<OrgActionResult<District>> {
  try {
    await requireSuperAdminPermission('Organization:Update');
    const { districtName, ...rest } = data;
    const normalizedPhone = normalizeEthiopianPhoneStrict(rest.contactPersonPhone);
    const district = await prisma.district.update({
      where: { id },
      data: {
        name: districtName,
        ...rest,
        contactPersonPhone: normalizedPhone,
      },
    });
    revalidatePath('/super-admin/organization');
    return { data: serialize(district) };
  } catch (error) {
    return { error: toOrgActionError(error, 'Failed to update the district.') };
  }
}

export async function deleteDistrict(id: string): Promise<OrgActionResult<District>> {
  try {
    await requireSuperAdminPermission('Organization:Delete');
    const branchCount = await prisma.branch.count({ where: { districtId: id } });
    if (branchCount > 0) {
      return { error: 'This district still has branches assigned to it. Remove or reassign its branches before deleting it.' };
    }
    const district = await prisma.district.delete({ where: { id } });
    revalidatePath('/super-admin/organization');
    return { data: serialize(district) };
  } catch (error) {
    return { error: toOrgActionError(error, 'Failed to delete the district.') };
  }
}

export async function updateBranch(id: string, data: { branchName: string; districtId: string; contactPersonName: string; contactPersonPhone: string }): Promise<OrgActionResult<Branch>> {
  try {
    await requireSuperAdminPermission('Organization:Update');
    const { branchName, ...rest } = data;
    const normalizedPhone = normalizeEthiopianPhoneStrict(rest.contactPersonPhone);
    const branch = await prisma.branch.update({
      where: { id },
      data: {
        name: branchName,
        ...rest,
        contactPersonPhone: normalizedPhone,
      },
    });
    revalidatePath('/super-admin/organization');
    return { data: serialize(branch) };
  } catch (error) {
    return { error: toOrgActionError(error, 'Failed to update the branch.') };
  }
}

export async function deleteBranch(id: string): Promise<OrgActionResult<Branch>> {
  try {
    await requireSuperAdminPermission('Organization:Delete');
    const userCount = await prisma.user.count({ where: { branchId: id } });
    if (userCount > 0) {
      return { error: 'This branch still has users assigned to it. Reassign or remove its users before deleting it.' };
    }
    const branch = await prisma.branch.delete({ where: { id } });
    revalidatePath('/super-admin/organization');
    return { data: serialize(branch) };
  } catch (error) {
    return { error: toOrgActionError(error, 'Failed to delete the branch.') };
  }
}

export async function bulkCreateDistricts(
  rows: { name: string; contactPersonName: string; contactPersonPhone: string }[]
): Promise<OrgActionResult<{ created: number; skipped: string[] }>> {
  try {
    await requireSuperAdminPermission('Organization:Create');

    const cleanedRows = rows
      .map((row) => ({
        name: (row.name ?? '').trim(),
        contactPersonName: (row.contactPersonName ?? '').trim(),
        contactPersonPhone: (row.contactPersonPhone ?? '').trim(),
      }))
      .filter((row) => row.name);
    if (cleanedRows.length === 0) {
      return { error: 'No valid district rows were found in the file.' };
    }

    // De-dupe by name (case-insensitive), keeping the first occurrence.
    const seenNames = new Set<string>();
    const dedupedRows = cleanedRows.filter((row) => {
      const key = row.name.toLowerCase();
      if (seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    });

    const existing = await prisma.district.findMany({
      where: { name: { in: dedupedRows.map((r) => r.name), mode: 'insensitive' } },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((d) => d.name.toLowerCase()));

    const toCreate: { name: string; contactPersonName: string; contactPersonPhone: string }[] = [];
    const skipped: string[] = [];

    for (const row of dedupedRows) {
      if (existingNames.has(row.name.toLowerCase())) {
        skipped.push(`${row.name} (already exists)`);
        continue;
      }
      if (!row.contactPersonName) {
        skipped.push(`${row.name} (missing Contact Person Name)`);
        continue;
      }
      if (!row.contactPersonPhone) {
        skipped.push(`${row.name} (missing Contact Person Phone)`);
        continue;
      }
      try {
        const normalizedPhone = normalizeEthiopianPhoneStrict(row.contactPersonPhone);
        toCreate.push({ name: row.name, contactPersonName: row.contactPersonName, contactPersonPhone: normalizedPhone });
      } catch (err) {
        skipped.push(`${row.name} (${err instanceof Error ? err.message : 'invalid Contact Person Phone'})`);
      }
    }

    if (toCreate.length > 0) {
      await prisma.district.createMany({ data: toCreate, skipDuplicates: true });
    }

    revalidatePath('/super-admin/organization');
    return { data: { created: toCreate.length, skipped } };
  } catch (error) {
    return { error: toOrgActionError(error, 'Failed to bulk upload districts.') };
  }
}

export async function bulkCreateBranches(
  rows: { name: string; district: string; contactPersonName: string; contactPersonPhone: string }[]
): Promise<OrgActionResult<{ created: number; skipped: string[] }>> {
  try {
    await requireSuperAdminPermission('Organization:Create');
    const cleanedRows = rows
      .map((row) => ({
        name: (row.name ?? '').trim(),
        district: (row.district ?? '').trim(),
        contactPersonName: (row.contactPersonName ?? '').trim(),
        contactPersonPhone: (row.contactPersonPhone ?? '').trim(),
      }))
      .filter((row) => row.name && row.district);
    if (cleanedRows.length === 0) {
      return { error: 'No valid branch rows were found in the file. Each row needs a "name" and a "district".' };
    }

    const districts = await prisma.district.findMany({ select: { id: true, name: true } });
    const districtIdByName = new Map(districts.map((d) => [d.name.toLowerCase(), d.id]));

    const toCreate: { name: string; districtId: string; contactPersonName: string; contactPersonPhone: string }[] = [];
    const skipped: string[] = [];
    for (const row of cleanedRows) {
      const districtId = districtIdByName.get(row.district.toLowerCase());
      if (!districtId) {
        skipped.push(`${row.name} (district "${row.district}" not found)`);
        continue;
      }
      if (!row.contactPersonName) {
        skipped.push(`${row.name} (missing Contact Person Name)`);
        continue;
      }
      if (!row.contactPersonPhone) {
        skipped.push(`${row.name} (missing Contact Person Phone)`);
        continue;
      }
      try {
        const normalizedPhone = normalizeEthiopianPhoneStrict(row.contactPersonPhone);
        toCreate.push({ name: row.name, districtId, contactPersonName: row.contactPersonName, contactPersonPhone: normalizedPhone });
      } catch (err) {
        skipped.push(`${row.name} (${err instanceof Error ? err.message : 'invalid Contact Person Phone'})`);
      }
    }

    if (toCreate.length > 0) {
      await prisma.branch.createMany({ data: toCreate });
    }

    revalidatePath('/super-admin/organization');
    return { data: { created: toCreate.length, skipped } };
  } catch (error) {
    return { error: toOrgActionError(error, 'Failed to bulk upload branches.') };
  }
}

async function requireOrgReadAccess() {
  // Branch/District lookups are also needed by the Users and Staff forms
  // (branch/organizer assignment dropdowns), not just the Organization module itself.
  const superAdmin = await requireSuperAdminPermission('Users:Read').catch(() => null);
  if (superAdmin) return superAdmin;
  return requireSuperAdminPermission('Organization:Read').catch(() =>
    requireSuperAdminPermission('Staff:Read')
  );
}

export async function getDistricts() {
  await requireOrgReadAccess();
  const districts = await prisma.district.findMany();
  return serialize(districts);
}

export async function getBranches() {
  await requireOrgReadAccess();
  const branches = await prisma.branch.findMany({ include: { district: true } });
  return serialize(branches);
}

// --- Homepage Carousel ---

export async function getHomeCarouselAdsAdmin() {
  await requireSuperAdminPermission('Homepage Carousel:Read');
  const ads = await prisma.homeCarouselAd.findMany({ orderBy: { sortOrder: 'asc' } });
  return serialize(ads);
}

export async function createHomeCarouselAd(data: {
  imageUrl: string;
  title?: string | null;
  caption?: string | null;
  linkUrl?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}) {
  await requireSuperAdminPermission('Homepage Carousel:Create');
  if (!data.imageUrl || typeof data.imageUrl !== 'string' || !data.imageUrl.trim()) {
    throw new Error('Image is required.');
  }
  const maxRow = await prisma.homeCarouselAd.aggregate({ _max: { sortOrder: true } });
  const nextOrder =
    typeof data.sortOrder === 'number' && !Number.isNaN(data.sortOrder) ? data.sortOrder : (maxRow._max.sortOrder ?? -1) + 1;

  const ad = await prisma.homeCarouselAd.create({
    data: {
      imageUrl: data.imageUrl.trim(),
      title: data.title?.trim() ? data.title.trim() : null,
      caption: data.caption?.trim() ? data.caption.trim() : null,
      linkUrl: data.linkUrl?.trim() ? data.linkUrl.trim() : null,
      sortOrder: nextOrder,
      isActive: data.isActive !== false,
    },
  });
  revalidatePath('/');
  revalidatePath('/super-admin/homeads');
  return serialize(ad);
}

export async function updateHomeCarouselAd(
  id: number,
  data: {
    imageUrl?: string;
    title?: string | null;
    caption?: string | null;
    linkUrl?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  }
) {
  await requireSuperAdminPermission('Homepage Carousel:Update');
  const payload: any = {};
  if (data.imageUrl !== undefined) {
    if (!data.imageUrl || !String(data.imageUrl).trim()) {
      throw new Error('Image URL cannot be empty.');
    }
    payload.imageUrl = String(data.imageUrl).trim();
  }
  if (data.title !== undefined) payload.title = data.title?.trim() ? data.title.trim() : null;
  if (data.caption !== undefined) payload.caption = data.caption?.trim() ? data.caption.trim() : null;
  if (data.linkUrl !== undefined) payload.linkUrl = data.linkUrl?.trim() ? data.linkUrl.trim() : null;
  if (data.sortOrder !== undefined && typeof data.sortOrder === 'number') {
    payload.sortOrder = data.sortOrder;
  }
  if (data.isActive !== undefined) payload.isActive = data.isActive;

  const ad = await prisma.homeCarouselAd.update({ where: { id }, data: payload });
  revalidatePath('/');
  revalidatePath('/super-admin/homeads');
  return serialize(ad);
}

export async function deleteHomeCarouselAd(id: number) {
  await requireSuperAdminPermission('Homepage Carousel:Delete');
  await prisma.homeCarouselAd.delete({ where: { id } });
  revalidatePath('/');
  revalidatePath('/super-admin/homeads');
  return { ok: true };
}
