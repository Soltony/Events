
import { NextRequest, NextResponse } from 'next/server';
import { getTicketsForUser } from '@/lib/actions';

export async function GET(req: NextRequest) {
  try {
    const phoneNumberParam = req.nextUrl.searchParams.get('phoneNumber');
    const userId = req.nextUrl.searchParams.get('userId') || undefined;

    const tickets = await getTicketsForUser(userId, phoneNumberParam || undefined);
    return NextResponse.json({ data: tickets });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
}
