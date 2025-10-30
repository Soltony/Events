import { NextRequest, NextResponse } from 'next/server';
import { getTicketsForUser } from '@/lib/actions';

export async function GET(req: NextRequest) {
  const phoneNumberParam = req.nextUrl.searchParams.get('phoneNumber');
  const userId = req.nextUrl.searchParams.get('userId') || undefined;

  // The getTicketsForUser function expects an array of phone numbers.
  const phoneNumbers = phoneNumberParam ? [phoneNumberParam] : undefined;

  try {
    const tickets = await getTicketsForUser(userId, phoneNumbers);
    return NextResponse.json({ data: tickets });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
}
