import { NextRequest, NextResponse } from 'next/server';
import { getTicketsForUser } from '@/lib/actions';

export async function GET(req: NextRequest) {
  const phoneNumber = req.nextUrl.searchParams.get('phoneNumber') || undefined;
  const userId = req.nextUrl.searchParams.get('userId') || undefined;

  try {
    const tickets = await getTicketsForUser(userId, phoneNumber);
    return NextResponse.json({ data: tickets });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
}
