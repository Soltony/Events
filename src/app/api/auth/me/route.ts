
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { toPublicUser } from '@/lib/public-profile';
import { withApiErrorHandling } from '@/lib/api-handler';

export const GET = withApiErrorHandling(async function GET(req: NextRequest) {
  const user = await verifyAuth(req);

  if (!user) {
    return NextResponse.json({ message: 'Authentication failed.' }, { status: 401 });
  }
  

  // The role object now contains the full permissions list from the database,
  // so we can send that to the client for UI purposes.
  return NextResponse.json(
    { user: { ...toPublicUser(user), isGuest: user.role.name === 'Guest' } },
    { status: 200 }
  );
});
