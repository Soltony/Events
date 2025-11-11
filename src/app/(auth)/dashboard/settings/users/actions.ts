
'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { sendTempPassword } from '@/lib/email';
import { getRoles } from '@/lib/actions';
import type { Role } from '@prisma/client';

function generateTempPassword(length = 12) {
  // Generate a random password with mixed characters, ensuring it's URL-safe and easy to copy.
  return crypto.randomBytes(length)
    .toString('base64')
    .slice(0, length)
    .replace(/\+/g, 'A') 
    .replace(/\//g, 'B'); 
}


export async function addUser(data: any, isStaffRegistration: boolean = false) {
    const { firstName, lastName, phoneNumber, email, roleId: requestedRoleId, nibBankAccount, branchId } = data;

    const phoneRegex = /^(09|07)\d{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
        return { success: false, error: "Phone number must start with 09 or 07 followed by 8 digits." };
    }
    
    const authApiUrl = process.env.AUTH_API_BASE_URL;
    if (!authApiUrl) {
      return { success: false, error: 'Auth API URL not configured.' };
    }
    
    const tempPassword = generateTempPassword();
    
    try {
        const registrationResponse = await fetch(`${authApiUrl}/api/Auth/register`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                firstName,
                lastName,
                phoneNumber,
                email,
                password: tempPassword, // Use the generated temporary password
            }),
        });
        
        const responseText = await registrationResponse.text();
        if (!responseText) {
            return { success: false, error: 'Registration service returned an empty response.' };
        }
        const responseData = JSON.parse(responseText);
                                              
        if (!responseData || !responseData.isSuccess) {
            let errorMessage = 'Failed to register user with auth service.';
            if (responseData.errors) {
              if (Array.isArray(responseData.errors)) {
                errorMessage = responseData.errors.join(', ');
              } else if (typeof responseData.errors === 'string') {
                errorMessage = responseData.errors;
              } else if (typeof responseData.errors === 'object') {
                errorMessage = Object.values(responseData.errors).flat().join(' ');
              }
            }
            return { success: false, error: errorMessage };
        }
        
        let newUserId;

        if (responseData.accessToken) {
            const token = responseData.accessToken;
            const payloadBase64 = token.split('.')[1];
            if (payloadBase64) {
                const decodedJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
                const decoded = JSON.parse(decodedJson);
                if (decoded && decoded.sub) {
                    newUserId = decoded.sub;
                }
            }
        }
        
        if (!newUserId) {
            console.error("Auth service response did not contain a user ID. Full response:", JSON.stringify(responseData, null, 2));
            return { success: false, error: "Auth service did not return a user ID." };
        }
        
        let finalRoleId = requestedRoleId;
        if (isStaffRegistration) {
            const roles = await getRoles();
            const staffRole = roles.find((r: Role) => r.name === 'Staff');
            if (!staffRole) {
                throw new Error("The 'Staff' role has not been created in the system. Please seed the database.");
            }
            finalRoleId = staffRole.id;
        }

        const createData: any = {
            id: newUserId,
            firstName,
            lastName,
            phoneNumber,
            roleId: finalRoleId,
            // Staff are active by default, others require approval/password change.
            passwordChangeRequired: !isStaffRegistration,
            status: isStaffRegistration ? 'ACTIVE' : 'INACTIVE', 
            nibBankAccount: nibBankAccount || null,
            email: email,
            tempPass: tempPassword, // Store the temporary password
        };

        if (branchId) {
            createData.branchId = branchId;
        }

        const user = await prisma.user.create({
            data: createData,
        });

        // Send email with credentials
        if (user.email) {
            await sendTempPassword({
                email: user.email,
                phoneNumber: user.phoneNumber,
                tempPassword: tempPassword,
            });
        }
    
        revalidatePath('/dashboard/settings/users');
        if (isStaffRegistration) {
            revalidatePath('/dashboard/settings/staff');
        }
        return { success: true, user: JSON.parse(JSON.stringify(user)) };

    } catch (error: any) {
        console.error("Error creating user:", error.message);
        
        if (error.code === 'P2002' && error.meta?.target?.includes('phoneNumber')) {
             return { success: false, error: `This phone number already exists.` };
        }

        if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
            return { success: false, error: 'A user with this email address already exists in the local database.' };
        }
        
        if (error.message.includes('already taken')) {
            return { success: false, error: error.message };
        }

        return { success: false, error: error.message || 'Failed to create user.' };
    }
}
