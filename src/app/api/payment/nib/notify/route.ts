
'use server';

import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
  let requestBody;
  try {
    requestBody = await request.json();
  } catch (e) {
    console.error("Callback Error: Invalid JSON in request body.", e);
    return NextResponse.json({ message: "Error Occurred: Invalid JSON" }, { status: 400 });
  }

  // Step 1: Get Header authorization details
  const headerList = headers();
  const authHeader = headerList.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error("Authorization header is missing or malformed.");
    return NextResponse.json(
      { status: 'error', message: 'Authorization header is required.' },
      { status: 401 }
    );
  }

  const tokenFromHeader = authHeader.substring(7);

  const {
    paidAmount,
    paidByNumber,
    txnRef,
    transactionId,
    transactionTime,
    accountNo,
    token: tokenFromBody,
    Signature: receivedSignature
  } = requestBody;

  // Step 2 & 3: Validate tokens and signature
  if (tokenFromHeader !== tokenFromBody) {
    console.error("Token mismatch between header and body.");
    return NextResponse.json({ message: "Token validation failed." }, { status: 401 });
  }

  const NIB_PAYMENT_KEY = process.env.NIB_PAYMENT_KEY;
  if (!NIB_PAYMENT_KEY) {
      console.error("NIB_PAYMENT_KEY is not set on the server.");
      return NextResponse.json({ message: "Server configuration error." }, { status: 500 });
  }

  // Validate signature for data integrity
  const signatureString = [
      `paidAmount=${String(paidAmount)}`,
      `paidByNumber=${paidByNumber}`,
      `txnRef=${txnRef}`,
      `transactionId=${transactionId}`,
      `transactionTime=${transactionTime}`,
      `accountNo=${accountNo}`,
      `token=${tokenFromBody}`,
      `Key=${NIB_PAYMENT_KEY}`
  ].join('&');

  const expectedSignature = crypto.createHash('sha256').update(signatureString, 'utf8').digest('hex');

  if (receivedSignature !== expectedSignature) {
    console.error("Signature validation failed.");
    console.log("Received Signature:", receivedSignature);
    console.log("Expected Signature:", expectedSignature);
    console.log("Signature String:", signatureString);
    return NextResponse.json({ message: "Signature validation failed." }, { status: 400 });
  }

  // Step 4: Process the payment
  try {
    const order = await prisma.pendingOrder.findFirst({
        where: { transactionId: transactionId },
    });

    if (!order) {
        console.error(`Order not found for transaction: ${transactionId}`);
        // Return 200 even if order not found to prevent gateway retries.
        return NextResponse.json({ message: 'Order not found, but acknowledged.' }, { status: 200 });
    }
    
    if (order.status === 'COMPLETED') {
        console.log(`Order for transaction ${transactionId} already handled.`);
        return NextResponse.json({ message: 'Already handled' }, { status: 200 });
    }

    await prisma.pendingOrder.update({
        where: { id: order.id },
        data: { 
            status: 'COMPLETED',
        },
    });

    // The rest of the logic (creating attendee, updating ticket count)
    // should be handled here based on the data stored in the `order`.

    console.log(`Successfully processed payment for transaction ${transactionId}.`);
    
    return NextResponse.json({ message: 'Payment confirmed and updated.' }, { status: 200 });

  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ message: 'Internal server error processing webhook.' }, { status: 500 });
  }
}
