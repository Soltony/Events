
'use server';

import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { sendTempPassword } from '@/lib/email';
import { randomBytes } from 'crypto';
import type { UserStatus } from '@prisma/client';

interface AddUserFormData {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  roleId?: string;
  branchId?: string | null;
  nibBankAccount?: string | null;
}

export async function addUser(data: AddUserFormData, isStaff: boolean = false) {
  try {
    const existingUserByPhone = await prisma.user.findUnique({
      where: { phoneNumber: data.phoneNumber },
    });
    if (existingUserByPhone) {
      return { success: false, error: 'Phone number is already registered.' };
    }

    if (data.email) {
      const existingUserByEmail = await prisma.user.findUnique({ where: { email: data.email } });
      if (existingUserByEmail) {
        return { success: false, error: 'Email is already registered.' };
      }
    }

    const tempPassword = randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    let roleId = data.roleId;
    let status: UserStatus = 'INACTIVE';

    if (isStaff) {
        const staffRole = await prisma.role.findUnique({
            where: { name: 'Staff' }
        });
        if (!staffRole) {
            return { success: false, error: 'Default "Staff" role not found.' };
        }
        roleId = staffRole.id;
        status = 'ACTIVE'; // Staff are active immediately
    } else if (!roleId) {
        return { success: false, error: 'A role must be selected for the user.' };
    }

    await prisma.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
        email: data.email,
        password: hashedPassword,
        passwordChangeRequired: true,
        roleId: roleId,
        status: status,
        branchId: data.branchId || null,
        nibBankAccount: data.nibBankAccount || null,
      },
    });

    // Send credentials via email
    await sendTempPassword({
      email: data.email,
      phoneNumber: data.phoneNumber,
      tempPassword: tempPassword,
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error creating user:", error);
    return { success: false, error: error.message || 'An unexpected error occurred.' };
  }
}
