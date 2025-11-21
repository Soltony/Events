
'use server';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { format } from 'date-fns';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[NIB INITIATE] Received body:', body);

    const { total, transactionId: pendingOrderTransactionId } = body;
    if (!total || !pendingOrderTransactionId) {
      return NextResponse.json({ error: 'Total and transaction ID are required.' }, { status: 400 });
    }

    const superAppToken = req.headers.get('Authorization')?.replace('Bearer ', '');

    if (!superAppToken) {
      return NextResponse.json({ error: 'SuperApp authorization token not found in header.' }, { status: 401 });
    }

    const pendingOrder = await prisma.pendingOrder.findUnique({
      where: { transactionId: pendingOrderTransactionId },
      include: { event: true },
    });

    if (!pendingOrder || !pendingOrder.event?.nibBankAccount) {
      return NextResponse.json({ error: 'Missing event or bank account info.' }, { status: 404 });
    }

    const ACCOUNT_NO = pendingOrder.event.nibBankAccount;
    const COMPANY_NAME = process.env.NIB_COMPANY_NAME;
    const NIB_PAYMENT_KEY = process.env.NIB_PAYMENT_KEY;
    const NIB_PAYMENT_URL = process.env.NIB_PAYMENT_URL;
    const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    const NIB_API_TOKEN = process.env.NIB_API_TOKEN;

    if (!COMPANY_NAME || !NIB_PAYMENT_KEY || !NIB_PAYMENT_URL || !APP_URL) {
      return NextResponse.json({ error: 'Missing required NIB environment variables' }, { status: 500 });
    }
    if (!NIB_API_TOKEN) {
      throw new Error('NIB_API_TOKEN is not set.');
    }

    const transactionId = crypto.randomUUID();
    const transactionTime = format(new Date(), 'yyyyMMddHHmmss');
    const callBackURL = `${APP_URL}/api/payment/nib/notify`;

    const signatureString = [
      `accountNo=${ACCOUNT_NO}`,
      `amount=${total}`,
      `callBackURL=${callBackURL}`,
      `companyName=${COMPANY_NAME}`,
      `Key=${NIB_PAYMENT_KEY}`,
      `token=${superAppToken}`,
      `transactionId=${transactionId}`,
      `transactionTime=${transactionTime}`,
    ].join('&');

    const signature = crypto.createHash('sha256').update(signatureString, 'utf8').digest('hex');

    const payload = {
      accountNo: ACCOUNT_NO,
      amount: String(total),
      callBackURL,
      companyName: COMPANY_NAME,
      token: superAppToken,
      transactionId,
      transactionTime,
      signature,
    };

    const eventPayment = await prisma.eventPayment.create({
      data: {
        amount: total,
        method: 'GATEWAY',
        status: 'PENDING',
        sessionId: null, // Will be updated after NIB call
        transactionId, // Our internal transaction ID
        pendingOrderId: pendingOrder.id,
        eventId: pendingOrder.eventId,
      },
    });

    console.log(`[NIB INITIATE] Created EventPayment record with ID: ${eventPayment.id}`);

    console.log('[NIB INITIATE] Calling NIB API at:', NIB_PAYMENT_URL);
    const response = await fetch(NIB_PAYMENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NIB_API_TOKEN}`, // Use the correct NIB API token
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('[NIB INITIATE] NIB raw response:', responseText);
    console.log('[NIB INITIATE] NIB API Response Status:', response.status);

    if (!response.ok) {
      return NextResponse.json({ error: 'NIB payment request failed', details: responseText }, { status: response.status });
    }

    let responseData;
    try {
        responseData = JSON.parse(responseText);
    } catch (e) {
        return NextResponse.json({ error: 'Failed to parse NIB response', raw: responseText }, { status: 502 });
    }
    
    if (!responseData.token) {
      return NextResponse.json({ error: 'NIB payment response invalid', raw: responseText }, { status: 502 });
    }

    await prisma.eventPayment.update({
      where: { id: eventPayment.id },
      data: { sessionId: responseData.token },
    });

    console.log('[NIB INITIATE] Payment sessionId saved:', responseData.token);

    return NextResponse.json({
      success: true,
      paymentToken: responseData.token,
      paymentId: eventPayment.id,
    });

  } catch (err: any) {
    console.error('[NIB INITIATE] Unexpected error in handler:', err);
    return NextResponse.json({ error: err.message || 'Unexpected server error.' }, { status: 500 });
  }
}
