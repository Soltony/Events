
'use server';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { format } from 'date-fns';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const body = await req.json();
    console.log('[NIB INITIATE] Received body:', body);

    const { total, transactionId: pendingOrderTransactionId } = body;

    if (!total || !pendingOrderTransactionId) {
      return NextResponse.json(
        { error: 'Total amount and transaction ID are required.' },
        { status: 400 }
      );
    }
    
    // Step 1: Get the SuperApp token from the cookie.
    const superAppToken = cookieStore.get('auth_token')?.value;
    console.log('[NIB INITIATE] Using token/phone from cookie:', superAppToken);

    if (!superAppToken) {
        throw new Error("SuperApp authorization token not found in cookie.");
    }

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
    const COMPANY_NAME = process.env.NEXT_PUBLIC_NIB_COMPANY_NAME;
    const NIB_PAYMENT_KEY = process.env.NEXT_PUBLIC_NIB_PAYMENT_KEY;
    const NIB_PAYMENT_URL = process.env.NEXT_PUBLIC_NIB_PAYMENT_URL;
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

    if (!COMPANY_NAME || !NIB_PAYMENT_KEY || !NIB_PAYMENT_URL || !APP_URL) {
      console.error('[NIB INITIATE] Missing required NIB environment variables');
      return NextResponse.json({ error: 'Server configuration error for payment.' }, { status: 500 });
    }
    
    console.log('[NIB INITIATE] Account No:', ACCOUNT_NO);

    const transactionId = crypto.randomUUID();
    const transactionTime = format(new Date(), 'yyyyMMddHHmmss');
    const callBackURL = `${APP_URL}/api/payment/nib/notify`;

    // Step 2: Build the signature string using the SuperApp token.
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

    await prisma.eventPayment.create({
      data: {
        amount: total,
        method: 'GATEWAY',
        status: 'PENDING',
        transactionId,
        pendingOrderId: pendingOrder.id,
        eventId: pendingOrder.eventId,
      },
    });

    console.log('[NIB INITIATE] Calling NIB Payment API...');
    
    // Step 3: Call the NIB Payment API directly with the SuperApp token.
    const response = await fetch(NIB_PAYMENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAppToken}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('[NIB INITIATE] NIB raw response:', responseText);

    if (!response.ok) {
      return NextResponse.json({ error: 'NIB payment request failed', details: responseText }, { status: response.status });
    }
    
    if (!responseText) {
        return NextResponse.json({ error: 'NIB payment response was empty.' }, { status: 502 });
    }

    const responseData = JSON.parse(responseText);

    if (!responseData.token) {
      return NextResponse.json({ error: 'NIB payment response invalid, missing token', raw: responseData }, { status: 502 });
    }
    
    await prisma.eventPayment.update({
      where: { transactionId },
      data: { sessionId: responseData.token },
    });
    
    console.log('[NIB INITIATE] Payment sessionId saved:', responseData.token);

    return NextResponse.json({
      success: true,
      paymentToken: responseData.token,
    });

  } catch (err: any) {
    console.error('[NIB INITIATE] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Unexpected server error.' }, { status: 500 });
  }
}
