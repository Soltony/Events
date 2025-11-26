
'use server';

import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { sendTempPassword } from '@/lib/email';
import { getCurrentUser } from '@/lib/actions';
import cuid from 'cuid';
import { normalizePhoneNumber } from '@/lib/utils';

interface AddUserResult {
  success: boolean;
  error?: string;
}

export async function addUser(
  data: {
    firstName: string;
    lastName: string;
    phoneNumber: string;
    email: string;
    roleId?: string;
    branchId?: string;
    nibBankAccount?: string | null;
  },
  isStaff: boolean = false
): Promise<AddUserResult> {
    const creator = await getCurrentUser();
    if (!creator) {
        return { success: false, error: 'You must be logged in to perform this action.' };
    }

    const normalizedPhone = normalizePhoneNumber(data.phoneNumber);

    try {
        const existingUserByPhone = await prisma.user.findUnique({
            where: { phoneNumber: normalizedPhone },
        });
        if (existingUserByPhone) {
            return { success: false, error: 'Phone number is already registered.' };
        }

        const existingUserByEmail = await prisma.user.findUnique({
            where: { email: data.email },
        });
        if (existingUserByEmail) {
            return { success: false, error: 'Email is already registered.' };
        }
        
        const tempPassword = nanoid(10);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        
        let roleId = data.roleId;
        let organizerId = isStaff ? creator.id : undefined;

        if (isStaff) {
             const staffRole = await prisma.role.findFirst({ where: { name: 'Staff' } });
             if (!staffRole) {
                return { success: false, error: 'Default role "Staff" not found.' };
            }
            roleId = staffRole.id;
        } else if (!roleId) {
            return { success: false, error: 'A role must be selected for the user.' };
        }
        

        const user = await prisma.user.create({
            data: {
                id: cuid(),
                firstName: data.firstName,
                lastName: data.lastName,
                phoneNumber: normalizedPhone,
                email: data.email,
                password: hashedPassword,
                roleId: roleId,
                branchId: data.branchId || null,
                nibBankAccount: data.nibBankAccount || null,
                status: 'ACTIVE',
                passwordChangeRequired: true,
                organizerId: organizerId,
            },
        });
        
        await sendTempPassword({
            email: data.email,
            phoneNumber: normalizedPhone,
            tempPassword: tempPassword,
        });

        return { success: true };

    } catch (error: any) {
        console.error("Failed to add user:", error);
        
        // Check for specific Prisma unique constraint errors
        if (error.code === 'P2002') {
             if (error.meta?.target?.includes('phoneNumber')) {
                return { success: false, error: "This phone number is already in use." };
            }
            if (error.meta?.target?.includes('email')) {
                return { success: false, error: "This email address is already in use." };
            }
        }

        return { success: false, error: error.message || "An unexpected error occurred." };
    }
}
