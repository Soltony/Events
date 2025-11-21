
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
      return NextResponse.json(
        { error: 'Total amount and transaction ID are required.' },
        { status: 400 }
      );
    }

    // --- 2. Get token or phone from cookies ---
    const cookieStore = cookies();
    const authCookie = cookieStore.get('auth_token')?.value;
    const phoneCookie = cookieStore.get('phone_number')?.value;

    const tokenForPayment = authCookie || phoneCookie;
    console.log('[NIB INITIATE] Using token/phone from cookie:', tokenForPayment);

    // --- 3. Fetch pending order and event ---
    const pendingOrder = await prisma.pendingOrder.findUnique({
      where: { transactionId: pendingOrderTransactionId },
      include: { event: true },
    });

    if (!pendingOrder || !pendingOrder.event?.nibBankAccount) {
      return NextResponse.json(
        { error: 'Missing event or bank account information.' },
        { status: 404 }
      );
    }

    const ACCOUNT_NO = pendingOrder.event.nibBankAccount;
    console.log('[NIB INITIATE] Account No:', ACCOUNT_NO);

    const COMPANY_NAME = process.env.NIB_COMPANY_NAME;
    const NIB_PAYMENT_KEY = process.env.NIB_PAYMENT_KEY;
    const NIB_PAYMENT_URL = process.env.NIB_PAYMENT_URL;
    const NIB_AUTH_URL = process.env.NIB_AUTH_URL;
    const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;

    if (!COMPANY_NAME || !NIB_PAYMENT_KEY || !NIB_PAYMENT_URL || !NIB_AUTH_URL || !APP_URL) {
      return NextResponse.json({ error: 'Missing required environment variables' }, { status: 500 });
    }

    // --- 4. Generate transaction info ---
    const transactionId = crypto.randomUUID();
    const transactionTime = format(new Date(), 'yyyyMMddHHmmss');
    const callBackURL = `${APP_URL}/api/payment/nib/notify`;

    // --- 5. Authenticate with NIB ---
    console.log('[NIB INITIATE] Authenticating with NIB...');
    let nibToken: string;
    try {
      const authResponse = await fetch(NIB_AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: COMPANY_NAME, Key: NIB_PAYMENT_KEY }), // Corrected from apiKey to Key
      });

      const authText = await authResponse.text();
      console.log('[NIB INITIATE] Auth raw response:', authText);

      if (!authResponse.ok) {
        return NextResponse.json({ error: 'Failed to authenticate with NIB', details: authText }, { status: 502 });
      }

      if (!authText) {
        return NextResponse.json({ error: 'NIB auth response was empty.' }, { status: 502 });
      }
      
      const authData = JSON.parse(authText);
      if (!authData.token) {
        return NextResponse.json({ error: 'NIB did not return a valid token', raw: authData }, { status: 502 });
      }

      nibToken = authData.token;
      console.log('[NIB INITIATE] NIB token received:', nibToken);
    } catch (err: any) {
      console.error('[NIB INITIATE] Auth request failed:', err);
      return NextResponse.json({ error: 'NIB auth request failed', details: err.message }, { status: 502 });
    }

    // --- 6. Build signature ---
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
      token: tokenForPayment, // token or guest phone
      signature,
    };

    // --- 7. Create EventPayment record ---
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

    // --- 8. Call NIB Payment API ---
    console.log('[NIB INITIATE] Calling NIB Payment API...');
    let responseData: any;
    try {
      const response = await fetch(NIB_PAYMENT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nibToken}`,
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log('[NIB INITIATE] NIB raw response:', responseText);

      if (!response.ok) {
        return NextResponse.json({ error: 'NIB payment request failed', details: responseText }, { status: 502 });
      }
      
      if (!responseText) {
        return NextResponse.json({ error: 'NIB payment response was empty.' }, { status: 502 });
      }

      responseData = JSON.parse(responseText);
      if (!responseData.token) {
        return NextResponse.json({ error: 'NIB payment response invalid', raw: responseText }, { status: 502 });
      }
    } catch (err: any) {
      console.error('[NIB INITIATE] Payment request failed:', err);
      return NextResponse.json({ error: 'NIB payment request failed', details: err.message }, { status: 502 });
    }

    // --- 9. Save sessionId ---
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
