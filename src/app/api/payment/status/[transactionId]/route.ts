
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { transactionId: string } }
) {
  const id = params.transactionId;
  const user = await getCurrentUser();

  try {
    if (!id) {
      return NextResponse.json({
        error: 'Invalid request',
        detail: 'Provide the transaction ID or session ID in the URL path.'
      }, { status: 400 });
    }

    // A user ID is not strictly required, as a guest could be checking.
    // However, if a user is logged in, we should scope the query.
    let whereClause: any = { 
        OR: [
            { transactionId: id },
            { arifpaySessionId: id },
        ]
    };
    
    // If a user is logged in, they can only query their own orders.
    // This adds a layer of authorization.
    if (user?.id) {
        whereClause.attendeeData = {
            path: ['userId'],
            equals: user.id
        };
    }

    const order = await prisma.pendingOrder.findFirst({
      where: whereClause,
    });

    if (!order) {
      return NextResponse.json({
        error: 'Order not found or access denied',
        detail: 'No order exists for the provided ID or you do not have permission to view it.'
      }, { status: 404 });
    }
    
    // Return only the status and, if completed, a reference to the transaction.
    // DO NOT return the internal attendeeId.
    if (order.status === 'COMPLETED') {
      return NextResponse.json({
        status: 'COMPLETED',
        // The transactionId is safe to return as it's the public reference.
        transactionId: order.transactionId 
      });
    }

    return NextResponse.json({ status: order.status });

  } catch (error) {
    console.error(`Failed to get payment status for ${id}:`, error);
    return NextResponse.json({
      error: 'Failed to fetch payment status',
      detail: 'An unexpected error occurred while checking the payment status.'
    }, { status: 500 });
  }
}
