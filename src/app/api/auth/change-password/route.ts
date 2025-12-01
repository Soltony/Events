
'use server';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, currentPassword, newPassword } = await req.json();

    if (!phoneNumber || !currentPassword || !newPassword) {
      return NextResponse.json({ message: 'All fields are required.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!user || !user.password) {
      return NextResponse.json({ message: 'Invalid credentials.' }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      return NextResponse.json({ errors: ['Incorrect current password.'] }, { status: 400 });
    }

    const newHashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: newHashedPassword,
        passwordChangeRequired: false,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('[CHANGE_PASSWORD_ERROR]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
