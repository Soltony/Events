
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ message: 'You must be logged in.' }, { status: 401 });
  }

  // Example of using session data on a protected server route
  return NextResponse.json({
    message: 'Access granted!',
    user: session.user,
  });
}
