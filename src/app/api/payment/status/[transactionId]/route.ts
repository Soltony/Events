
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { transactionId: string } }
) {
  const { transactionId } = params;

  if (!transactionId) {
    return NextResponse.json({ error: 'Transaction ID is required.' }, { status: 400 });
  }

  try {
    const order = await prisma.pendingOrder.findFirst({
      where: {
        OR: [
          { transactionId: transactionId },
          { arifpaySessionId: transactionId } 
        ]
      },
      select: {
        status: true,
        transactionId: true,
        attendeeId: true
      }
    });

    if (!order) {
      return NextResponse.json({ status: 'NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({
      status: order.status,
      transactionId: order.transactionId,
      attendeeId: order.attendeeId
    });
  } catch (error) {
    console.error(`Failed to get payment status for ${transactionId}:`, error);
    return NextResponse.json({
      error: 'Failed to fetch payment status',
      detail: 'An unexpected error occurred while checking the payment status.'
    }, { status: 500 });
  }
}
