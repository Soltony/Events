
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ transactionId: string }> }
): Promise<NextResponse> {
  // Await the params promise
  const { transactionId } = await context.params;

  if (!transactionId) {
    return NextResponse.json(
      { error: 'Transaction ID is required.' },
      { status: 400 }
    );
  }

  try {
    const order = await prisma.pendingOrder.findFirst({
      where: {
        OR: [
          { transactionId },
          { arifpaySessionId: transactionId },
        ],
      },
      select: {
        status: true,
        transactionId: true,
        attendeeId: true,
      },
    });

    if (order) {
      return NextResponse.json({
        status: order.status,
        transactionId: order.transactionId,
        attendeeId: order.attendeeId,
      });
    }

    // Fallback to event payments so we can resolve using the payment gateway reference
    const payment = await prisma.eventPayment.findFirst({
      where: {
        OR: [
          { transactionId },
          { reference: transactionId },
        ],
      },
      select: {
        pendingOrder: {
          select: {
            status: true,
            transactionId: true,
            attendeeId: true,
          },
        },
      },
    });

    if (payment?.pendingOrder) {
      return NextResponse.json({
        status: payment.pendingOrder.status,
        transactionId: payment.pendingOrder.transactionId,
        attendeeId: payment.pendingOrder.attendeeId,
      });
    }

    return NextResponse.json({ status: 'NOT_FOUND' }, { status: 404 });
  } catch (error) {
    console.error(`Failed to get payment status for ${transactionId}:`, error);
    return NextResponse.json(
      {
        error: 'Failed to fetch payment status',
        detail:
          'An unexpected error occurred while checking the payment status.',
      },
      { status: 500 }
    );
  }
}
