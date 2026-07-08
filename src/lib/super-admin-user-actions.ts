
'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import type { Role, User, UserStatus } from '@prisma/client';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import cuid from 'cuid';
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
  if (!newRoleId) return;

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

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) {
    throw new Error('User not found.');
  }

  const { firstName, lastName, phoneNumber, roleId, nibBankAccount, email, branchId } = data;

  await validateRoleAssignment(roleId);

  const normalizedPhoneNumber =
    typeof phoneNumber === 'string' && phoneNumber.trim().length > 0
      ? normalizeEthiopianPhoneStrict(phoneNumber)
      : undefined;

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
      },
    });
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

  await validateRoleAssignment(newRoleId);
  const user = await prisma.user.update({
    where: { id: userId },
    data: { roleId: newRoleId },
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

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) {
    throw new Error('User not found.');
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

    if (userToDelete?.role?.name === 'Organizer') {
      await prisma.user.deleteMany({ where: { organizerId: userId } });
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
): Promise<{ success: boolean; error?: string }> {
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

    try {
      await validateRoleAssignment(data.roleId);
    } catch (e: any) {
      return { success: false, error: e?.message || 'Permission denied.' };
    }

    const tempPassword = nanoid(10);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

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
        status: 'ACTIVE',
        passwordChangeRequired: true,
        tokenVersion: 1,
      },
    });

    await sendTempPassword({ email: data.email, phoneNumber: normalizedPhone, tempPassword });

    return { success: true };
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

// --- Staff management (Super Admin explicitly assigns which Organizer a Staff member belongs to) ---

export async function getStaffForUser(organizerId: string | undefined) {
  await requireSuperAdminPermission('Staff:Read');
  if (!organizerId) return [];

  const staff = await prisma.user.findMany({
    where: { organizerId },
    include: {
      role: true,
      branch: { include: { district: true } },
    },
  });

  const staffWithoutPasswords = staff.map(({ password: _password, ...rest }) => rest);
  return serialize(staffWithoutPasswords);
}

export async function getOrganizers() {
  await requireSuperAdminPermission('Staff:Read');
  const organizers = await prisma.user.findMany({
    where: { role: { name: 'Organizer' } },
    select: { id: true, firstName: true, lastName: true, phoneNumber: true },
    orderBy: { firstName: 'asc' },
  });
  return serialize(organizers);
}

export async function addStaff(
  data: {
    firstName: string;
    lastName: string;
    phoneNumber: string;
    email: string;
    organizerId: string;
  }
): Promise<{ success: boolean; error?: string }> {
  await requireSuperAdminPermission('Staff:Create');

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

    const organizer = await prisma.user.findUnique({ where: { id: data.organizerId } });
    if (!organizer) {
      return { success: false, error: 'Selected organizer not found.' };
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
        organizerId: data.organizerId,
        status: 'ACTIVE',
        passwordChangeRequired: true,
        tokenVersion: 1,
      },
    });

    await sendTempPassword({ email: data.email, phoneNumber: normalizedPhone, tempPassword });

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
  await requireSuperAdminPermission('Staff:Update');

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

  revalidatePath('/super-admin/staff');
  return { ok: true };
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

export async function createDistrict(data: { districtName: string; contactPersonName: string; contactPersonPhone: string }) {
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
  return serialize(district);
}

export async function createBranch(data: { branchName: string; districtId: string; contactPersonName: string; contactPersonPhone: string }) {
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
  return serialize(branch);
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
