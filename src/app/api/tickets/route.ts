
import { NextRequest, NextResponse } from 'next/server';
import { getTicketsForUser } from '@/lib/actions';
import { verifyAuth } from '@/lib/auth-middleware';
import { withApiErrorHandling } from '@/lib/api-handler';

export const GET = withApiErrorHandling(async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const phoneNumberParam = req.nextUrl.searchParams.get('phoneNumber');
    const userId = req.nextUrl.searchParams.get('userId') || undefined;

    const tickets = await getTicketsForUser(user, userId, phoneNumberParam || undefined);
    return NextResponse.json({ data: tickets });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    const denied = error instanceof Error && error.message === 'Permission denied.';
    return NextResponse.json(
      { error: denied ? 'Permission denied.' : 'Failed to fetch tickets' },
      { status: denied ? 403 : 500 }
    );
  }
});
