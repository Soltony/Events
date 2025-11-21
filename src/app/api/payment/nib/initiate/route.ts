'use server';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { format } from 'date-fns';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // --- 1. Parse request body ---
    const body = await req.json();
    console.log('[NIB INITIATE] Received body:', body);

    const { total, transactionId: pendingOrderTransactionId } = body;
    if (!total || !pendingOrderTransactionId) {
      return NextResponse.json({ error: 'Total and transaction ID are required.' }, { status: 400 });
    }

    // --- 2. Get user token or phone from cookies ---
    const cookieStore = cookies();
    const authCookie = cookieStore.get('auth')?.value;
    const phoneCookie = cookieStore.get('phone_number')?.value;
    const tokenForPayment = authCookie || phoneCookie;
    console.log('[NIB INITIATE] Using token/phone from cookie:', tokenForPayment);

    // --- 3. Fetch pending order and event ---
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

    if (!COMPANY_NAME || !NIB_PAYMENT_KEY || !NIB_PAYMENT_URL || !APP_URL) {
      return NextResponse.json({ error: 'Missing required environment variables' }, { status: 500 });
    }

    // --- 4. Generate transaction info ---
    const transactionId = crypto.randomUUID();
    const transactionTime = format(new Date(), 'yyyyMMddHHmmss');
    const callBackURL = `${APP_URL}/api/payment/nib/notify`;

    // --- 5. Build signature ---
    const signatureString = [
      `accountNo=${ACCOUNT_NO}`,
      `amount=${total}`,
      `callBackURL=${callBackURL}`,
      `companyName=${COMPANY_NAME}`,
      `Key=${NIB_PAYMENT_KEY}`,
      `transactionId=${transactionId}`,
      `transactionTime=${transactionTime}`,
    ].join('&');

    const signature = crypto.createHash('sha256').update(signatureString, 'utf8').digest('hex');

    const payload = {
      accountNo: ACCOUNT_NO,
      amount: String(total),
      callBackURL,
      companyName: COMPANY_NAME,
      transactionId,
      transactionTime,
      token: tokenForPayment,
      signature,
    };

    // --- 6. Create EventPayment record ---
    const eventPayment = await prisma.eventPayment.create({
      data: {
        amount: total,
        method: 'GATEWAY',
        status: 'PENDING',
        sessionId: null,
        transactionId,
        pendingOrderId: pendingOrder.id,
        eventId: pendingOrder.eventId,
      },
    });

    console.log('[NIB INITIATE] EventPayment record created:', eventPayment.id);

    // --- 7. Call NIB Payment API ---
    console.log('[NIB INITIATE] Calling NIB Payment API...');
    const response = await fetch(NIB_PAYMENT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('[NIB INITIATE] NIB raw response:', responseText);

    if (!response.ok) {
      return NextResponse.json({ error: 'NIB payment request failed', details: responseText }, { status: 502 });
    }

    const responseData = JSON.parse(responseText);
    if (!responseData.token) {
      return NextResponse.json({ error: 'NIB payment response invalid', raw: responseText }, { status: 502 });
    }

    // --- 8. Save sessionId ---
    await prisma.eventPayment.update({
      where: { transactionId },
      data: { sessionId: responseData.token },
    });

    console.log('[NIB INITIATE] Payment sessionId saved:', responseData.token);

    return NextResponse.json({
      success: true,
      paymentToken: responseData.token,
      paymentId: eventPayment.id,
    });

  } catch (err: any) {
    console.error('[NIB INITIATE] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Unexpected server error.' }, { status: 500 });
  }
}
