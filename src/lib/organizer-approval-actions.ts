
'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import type { UserStatus } from '@prisma/client';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import { sendTempPassword } from '@/lib/email';
import { requireSuperAdminPermission } from '@/lib/super-admin-auth';

const serialize = (data: any) => {
  if (!data) return null;
  return JSON.parse(JSON.stringify(data, (key, value) => (typeof value === 'bigint' ? value.toString() : value)));
};

const APPROVAL_PERMISSION = 'Organizer Approvals:Access';

function revalidateOrganizerApprovalPaths() {
  revalidatePath('/dashboard/organizer-approvals');
  revalidatePath('/super-admin/organizer-approvals');
  revalidatePath('/dashboard/users');
  revalidatePath('/super-admin/users');
}

export async function getOrganizerRegistrations(status?: UserStatus | 'all') {
  await requireSuperAdminPermission(APPROVAL_PERMISSION);

  const whereClause: any = { role: { name: 'Organizer' } };
  if (status && status !== 'all') {
    whereClause.status = status;
  }

  const organizers = await prisma.user.findMany({
    where: whereClause,
    include: {
      branch: { include: { district: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const withoutPasswords = organizers.map(({ password: _password, ...rest }) => rest);
  return serialize(withoutPasswords);
}

export async function approveOrganizer(userId: string) {
  await requireSuperAdminPermission(APPROVAL_PERMISSION);

  const target = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!target || target.role.name !== 'Organizer') {
    throw new Error('Organizer registration not found.');
  }
  if (target.status === 'ACTIVE') {
    throw new Error('This organizer is already approved.');
  }

  const tempPassword = nanoid(12);
  const hashedPassword = await bcrypt.hash(tempPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: 'ACTIVE',
      rejectionReason: null,
      password: hashedPassword,
      passwordUpdatedAt: new Date(),
      passwordChangeRequired: true,
      tokenVersion: { increment: 1 },
    },
  });

  await prisma.session.updateMany({
    where: { userId: userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (target.email) {
    await sendTempPassword({ email: target.email, phoneNumber: target.phoneNumber, tempPassword });
  }

  revalidateOrganizerApprovalPaths();
  return { success: true };
}

export async function rejectOrganizer(userId: string, reason?: string) {
  await requireSuperAdminPermission(APPROVAL_PERMISSION);

  const target = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!target || target.role.name !== 'Organizer') {
    throw new Error('Organizer registration not found.');
  }
  if (target.status === 'REJECTED') {
    throw new Error('This organizer is already rejected.');
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: 'REJECTED',
      rejectionReason: reason || null,
      tokenVersion: { increment: 1 },
    },
  });

  await prisma.session.updateMany({
    where: { userId: userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  revalidateOrganizerApprovalPaths();
  return { success: true };
}
