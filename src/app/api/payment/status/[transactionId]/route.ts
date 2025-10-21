
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/actions';
import { createHmac } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  const { transactionId: id } = await params;
  const user = await getCurrentUser();

  try {
    if (!id) {
      return NextResponse.json({
        error: 'Invalid request',
        detail: 'Provide the transaction ID or session ID in the URL path.'
      }, { status: 400 });
    }

    // Require either logged-in user or a valid signed token for guests
    const statusToken = req.nextUrl.searchParams.get('token');
    if (!user?.id) {
      const SIGN_SECRET = process.env.PAYMENT_STATUS_SECRET;
      if (!SIGN_SECRET || !statusToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const parts = statusToken.split('.');
      if (parts.length !== 3) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const [tokenId, expStr, sig] = parts;
      if (tokenId !== id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const expiresAt = Number(expStr);
      if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
        return NextResponse.json({ error: 'Token expired' }, { status: 401 });
      }
      const expected = createHmac('sha256', SIGN_SECRET).update(`${tokenId}.${expiresAt}`).digest('hex');
      if (expected !== sig) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // If a user is logged in, scope the query to their orders
    let whereClause: any = { 
        OR: [
            { transactionId: id },
            { arifpaySessionId: id },
        ]
    };
    
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
    
    // Return only the status and public reference
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
