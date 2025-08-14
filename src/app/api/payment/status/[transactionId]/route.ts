
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function checkGatewayStatus(sessionId: string) {
    const gatewayUrl = process.env.PAYMENT_GATEWAY_URL;
    const apiKey = process.env.PAYMENT_GATEWAY_API_KEY;

    if (!gatewayUrl || !apiKey) {
        console.error("Payment gateway environment variables are not set for status check.");
        return null;
    }

    try {
        const response = await fetch(`${gatewayUrl}/status/${sessionId}`, {
            method: 'GET',
            headers: {
                'Api-Key': apiKey,
            },
            cache: 'no-store',
        });
        
        if (!response.ok) {
            console.error(`Gateway status check failed for session ${sessionId} with status: ${response.status}`);
            return null;
        }

        const result = await response.json();
        if (result.ResponseCode === "0" && result.Data?.TransactionStatus) {
            return result.Data.TransactionStatus;
        }
        return null;

    } catch (error) {
        console.error(`Error during gateway status check for session ${sessionId}:`, error);
        return null;
    }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { transactionId: string } }
) {
  const localTransactionId = params.transactionId;

  try {
    if (!localTransactionId) {
      return NextResponse.json({ error: 'Transaction ID is required.' }, { status: 400 });
    }

    const order = await prisma.pendingOrder.findUnique({
      where: { transactionId: localTransactionId },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    
    // If the order is completed in our DB, we're done.
    if (order.status === 'COMPLETED' && order.attendeeId) {
      return NextResponse.json({
        status: 'COMPLETED',
        attendeeId: order.attendeeId,
      });
    }

    // If still pending, check the external gateway for an update.
    if (order.status === 'PENDING' && order.arifpaySessionId) {
        const gatewayStatus = await checkGatewayStatus(order.arifpaySessionId);
        if (gatewayStatus === 'SUCCESS') {
            // The webhook might have been delayed. We can return a completed status
            // The webhook will eventually run and create the attendee.
            // For a better UX, we can just signal completion.
            // The success page will keep polling until attendeeId is available.
        }
    }

    return NextResponse.json({ status: order.status });

  } catch (error) {
    console.error(`Failed to get payment status for ${localTransactionId}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
