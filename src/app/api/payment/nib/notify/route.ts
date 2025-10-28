'use server';

import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  let requestBody;
  try {
    requestBody = await request.json();
  } catch (e) {
    console.error("Callback Error: Invalid JSON in request body.", e);
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  // Step 1: Get Authorization header
  const headerList = await headers();
  const authHeader = headerList.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error("Authorization header is missing or malformed.");
    return NextResponse.json({ message: 'Authorization header is required.' }, { status: 401 });
  }

  const tokenFromHeader = authHeader.substring(7);

  const {
    paidAmount,
    txnRef,
    transactionId,
    token: tokenFromBody,
  } = requestBody;

  // Step 2: Token validation
  if (tokenFromHeader !== tokenFromBody) {
    console.error("Token mismatch between header and body.");
    return NextResponse.json({ message: "Token validation failed." }, { status: 401 });
  }

  // Step 3: Signature validation (optional, uncomment if using)
  // const NIB_PAYMENT_KEY = process.env.NIB_PAYMENT_KEY;
  // const signatureString = [
  //     `paidAmount=${String(paidAmount)}`,
  //     `paidByNumber=${paidByNumber}`,
  //     `txnRef=${txnRef}`,
  //     `transactionId=${transactionId}`,
  //     `transactionTime=${transactionTime}`,
  //     `accountNo=${accountNo}`,
  //     `token=${tokenFromBody}`,
  //     `Key=${NIB_PAYMENT_KEY}`
  // ].join('&');
  // const expectedSignature = crypto.createHash('sha256').update(signatureString, 'utf8').digest('hex');
  // if (receivedSignature !== expectedSignature) {
  //   console.error("Signature validation failed.");
  //   return NextResponse.json({ message: "Signature validation failed." }, { status: 400 });
  // }

  // Step 4: Process payment
  try {
    const order = await prisma.eventPayment.findFirst({
  where: { transactionId:  txnRef },
});

    if (!order) {
      console.error(`Order not found for transaction: ${transactionId}`);
      return NextResponse.json({ message: 'Order not found, but acknowledged.' }, { status: 200 });
    }

    if (order.status === 'COMPLETED') {
      console.log(`Order for transaction ${transactionId} already handled.`);
      return NextResponse.json({ message: 'Already handled' }, { status: 200 });
    }

    // Update pendingOrder status
    await prisma.pendingOrder.updateMany({
      where: { id: order.pendingOrderId },
      data: { status: 'COMPLETED' },
    });

    // Update corresponding EventPayment
    const eventPayment = await prisma.eventPayment.update({
      where: { id: order.id },
      data: {
        status: 'COMPLETED',
        amount: paidAmount,
        paymentDate: new Date(),
        method: 'GATEWAY',
        reference: transactionId,
        sessionId: txnRef, // optionally store sessionId if available
      },
    });

    console.log(`Successfully processed payment for transaction ${transactionId}.`);

    return NextResponse.json({ message: 'Payment confirmed and updated.' }, { status: 200 });

  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ message: 'Internal server error processing webhook.' }, { status: 500 });
  }
}
