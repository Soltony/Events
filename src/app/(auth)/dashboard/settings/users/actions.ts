
'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function addUser(data: any) {
    const { firstName, lastName, phoneNumber, email, roleId, nibBankAccount } = data;

    const phoneRegex = /^(09|07)\d{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
        return { success: false, error: "Phone number must start with 09 or 07 followed by 8 digits." };
    }
    
    const authApiUrl = process.env.AUTH_API_BASE_URL;
    if (!authApiUrl) {
      return { success: false, error: 'Auth API URL not configured.' };
    }
    
    const password = 'User@123';
    
    try {
        const authServiceEmail = email || `${phoneNumber}@nibtickets.com`;

        const registrationResponse = await fetch(`${authApiUrl}/api/Auth/register`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                firstName,
                lastName,
                phoneNumber,
                email: authServiceEmail,
                password,
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
        
        const createData: any = {
            id: newUserId,
            firstName,
            lastName,
            phoneNumber,
            roleId,
            passwordChangeRequired: true,
            nibBankAccount: nibBankAccount || null,
        };

        if (email) {
            createData.email = email;
        }

        const user = await prisma.user.create({
            data: createData,
        });
    
        revalidatePath('/dashboard/settings/users');
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
