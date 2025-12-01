
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ message: 'You must be logged in.' }, { status: 401 });
  }

  return NextResponse.json({
    message: 'Access granted!',
    user: session.user,
  });
}
