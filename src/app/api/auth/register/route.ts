
'use server';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import cuid from 'cuid';

export async function POST(req: NextRequest) {
  try {
    const { firstName, lastName, phoneNumber, email, password } = await req.json();

    if (!firstName || !lastName || !phoneNumber || !password) {
      return NextResponse.json({ message: 'All fields are required.' }, { status: 400 });
    }

    const existingUserByPhone = await prisma.user.findUnique({
      where: { phoneNumber },
    });
    if (existingUserByPhone) {
      return NextResponse.json({ message: 'Phone number is already registered.' }, { status: 409 });
    }
    
    if (email) {
        const existingUserByEmail = await prisma.user.findUnique({ where: { email } });
        if (existingUserByEmail) {
            return NextResponse.json({ message: 'Email is already registered.' }, { status: 409 });
        }
    }


    const hashedPassword = await bcrypt.hash(password, 10);
    
    const organizerRole = await prisma.role.findFirst({
        where: { name: 'Organizer' }
    });

    if (!organizerRole) {
        return NextResponse.json({ message: 'Default role "Organizer" not found.' }, { status: 500 });
    }

    const user = await prisma.user.create({
      data: {
        id: cuid(),
        firstName,
        lastName,
        phoneNumber,
        email,
        password: hashedPassword,
        roleId: organizerRole.id,
        status: 'INACTIVE', // Accounts are inactive until approved by an admin
        passwordChangeRequired: true,
      },
    });

    // Remove password from the returned user object
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({ user: userWithoutPassword }, { status: 201 });
  } catch (error) {
    console.error('[REGISTRATION_ERROR]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
