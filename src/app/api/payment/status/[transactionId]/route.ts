import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: { transactionId: string } }
) {
  const { transactionId } = context.params;

  try {
    if (!transactionId) {
      return NextResponse.json({ error: 'Transaction ID is required.' }, { status: 400 });
    }

    const order = await prisma.pendingOrder.findUnique({
      where: { transactionId },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    
    if (order.status === 'COMPLETED' && order.attendeeId) {
      return NextResponse.json({
        status: 'COMPLETED',
        attendeeId: order.attendeeId,
      });
    }

    return NextResponse.json({ status: order.status });

  } catch (error) {
    console.error(`Failed to get payment status for ${transactionId}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
