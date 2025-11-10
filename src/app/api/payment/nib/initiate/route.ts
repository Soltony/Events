'use server';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { format } from 'date-fns';
import { cookies } from 'next/headers';
import { decryptSessionPayload } from '@/lib/sessionCrypto';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { total, transactionId: pendingOrderTransactionId } = body;

    if (!total || !pendingOrderTransactionId) {
      return NextResponse.json(
        { error: 'Total amount and transaction ID are required.' },
        { status: 400 }
      );
    }

    // --- Fetch auth token from secure session cookie ---
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('auth');
    if (!sessionCookie?.value) {
      return NextResponse.json(
        { error: 'Unauthorized', detail: 'User session not found.' },
        { status: 401 }
      );
    }

    const decryptedSession = await decryptSessionPayload(sessionCookie.value);
    const { accessToken: authToken } = JSON.parse(decryptedSession);

    if (!authToken) {
      return NextResponse.json(
        { error: 'Unauthorized', detail: 'Auth token is missing from session.' },
        { status: 401 }
      );
    }

    const ACCOUNT_NO = process.env.NIB_ACCOUNT_NO;
    const COMPANY_NAME = process.env.NIB_COMPANY_NAME;
    const NIB_PAYMENT_KEY = process.env.NIB_PAYMENT_KEY;
    const NIB_PAYMENT_URL = process.env.NIB_PAYMENT_URL;
    const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;

    if (!ACCOUNT_NO || !COMPANY_NAME || !NIB_PAYMENT_KEY || !NIB_PAYMENT_URL || !APP_URL) {
      return NextResponse.json(
        { error: 'Payment gateway configuration is missing on the server.' },
        { status: 500 }
      );
    }

    // --- Generate NIB-specific transaction ID and signature ---
    const transactionId = crypto.randomUUID();
    const transactionTime = format(new Date(), 'yyyyMMddHHmmss');
    const callBackURL = `${APP_URL}/api/payment/nib/notify`;

    const signatureString = [
      `accountNo=${ACCOUNT_NO}`,
      `amount=${total}`,
      `callBackURL=${callBackURL}`,
      `companyName=${COMPANY_NAME}`,
      `Key=${NIB_PAYMENT_KEY}`,
      `token=${authToken}`,
      `transactionId=${transactionId}`,
      `transactionTime=${transactionTime}`
    ].join('&');

    const signature = crypto.createHash('sha256').update(signatureString, 'utf8').digest('hex');

    const payload = {
      accountNo: ACCOUNT_NO,
      amount: String(total),
      callBackURL,
      companyName: COMPANY_NAME,
      token: authToken,
      transactionId: transactionId,
      transactionTime,
      signature
    };

    // --- Create EventPayment record in the database ---
    const pendingOrder = await prisma.pendingOrder.findUnique({
      where: { transactionId: pendingOrderTransactionId },
      include: { event: true }
    });

    if (!pendingOrder) {
      return NextResponse.json(
        { error: 'Pending order not found.' },
        { status: 404 }
      );
    }

    const eventPayment = await prisma.eventPayment.create({
      data: {
        amount: total,
        method: 'GATEWAY',
        status: 'PENDING',
        sessionId: null, // Will be filled if NIB returns a session ID
        transactionId: transactionId,
        pendingOrderId: pendingOrder.id,
        eventId: pendingOrder.eventId,
      }
    });

    // --- Call NIB API ---
    const response = await fetch(NIB_PAYMENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorText = `Failed to get payment token from gateway. Status: ${response.status}`;
      try {
        const errorBody = await response.json();
        errorText = errorBody.detail || errorBody.error || errorText;
      } catch {}
      return NextResponse.json({ error: errorText, status: response.status }, { status: response.status });
    }

    const responseText = await response.text();
    if (!responseText) {
      return NextResponse.json(
        { error: "Received empty response from payment gateway.", status: 502 },
        { status: 502 }
      );
    }

    const responseData = JSON.parse(responseText);

    if (!responseData.token) {
      return NextResponse.json(
        { error: "Payment gateway did not return a valid payment token.", status: 502 },
        { status: 502 }
      );
    }

    // Optionally update sessionId if NIB provides one
    await prisma.eventPayment.update({
      where: { transactionId },
      data: { sessionId: responseData.token }
    });

    return NextResponse.json({
      success: true,
      paymentToken: responseData.token,
      paymentId: eventPayment.id
    });

  } catch (error: any) {
    console.error('Payment initiation error:', error);
    return NextResponse.json(
      { error: error.message || 'Unexpected error during payment initiation.' },
      { status: 500 }
    );
  }
}
