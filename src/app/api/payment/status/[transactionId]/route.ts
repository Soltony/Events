
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { transactionId: string } }
) {
  const id = params.transactionId;

  try {
    if (!id) {
      return NextResponse.json({ error: 'Transaction ID or Session ID is required.' }, { status: 400 });
    }

    const order = await prisma.pendingOrder.findFirst({
      where: { 
          OR: [
              { transactionId: id },
              { arifpaySessionId: id },
          ]
      },
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
    console.error(`Failed to get payment status for ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
