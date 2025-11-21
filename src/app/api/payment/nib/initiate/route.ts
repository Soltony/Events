
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

    // --- 2. Get user's token/phone from cookies for the payload ---
    const cookieStore = cookies();
    const authCookie = cookieStore.get('auth_token')?.value;
    const phoneCookie = cookieStore.get('phone_number')?.value;

    const tokenForPayload = authCookie || phoneCookie;
    if (!tokenForPayload) {
      return NextResponse.json({ error: 'User session token or phone number not found in cookies.' }, { status: 401 });
    }
    console.log('[NIB INITIATE] Using token/phone from cookie:', tokenForPayload);


    // --- 3. Fetch pending order and event to get the destination account ---
    const pendingOrder = await prisma.pendingOrder.findUnique({
      where: { transactionId: pendingOrderTransactionId },
      include: { event: true },
    });

    if (!pendingOrder || !pendingOrder.event?.nibBankAccount) {
      return NextResponse.json(
        { error: 'Missing event or bank account information for the order.' },
        { status: 404 }
      );
    }
    const ACCOUNT_NO = pendingOrder.event.nibBankAccount;
    console.log('[NIB INITIATE] Account No:', ACCOUNT_NO);


    // --- 4. Load required environment variables ---
    const COMPANY_NAME = process.env.NIB_COMPANY_NAME;
    const NIB_PAYMENT_KEY = process.env.NIB_PAYMENT_KEY;
    const NIB_PAYMENT_URL = process.env.NIB_PAYMENT_URL;
    const NIB_AUTH_URL = process.env.NIB_AUTH_URL;
    const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;

    if (!COMPANY_NAME || !NIB_PAYMENT_KEY || !NIB_PAYMENT_URL || !NIB_AUTH_URL || !APP_URL) {
      return NextResponse.json({ error: 'Server is missing required NIB payment environment variables.' }, { status: 500 });
    }

    // --- 5. Authenticate with NIB to get a temporary API token ---
    console.log('[NIB INITIATE] Authenticating with NIB...');
    let nibToken: string;
    try {
      const authResponse = await fetch(NIB_AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: COMPANY_NAME, apiKey: NIB_PAYMENT_KEY }),
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
        return NextResponse.json({ error: 'NIB did not return a valid token from auth endpoint', raw: authData }, { status: 502 });
      }

      nibToken = authData.token;
      console.log('[NIB INITIATE] NIB temporary token received:', nibToken);
    } catch (err: any) {
      console.error('[NIB INITIATE] NIB Auth request failed:', err);
      return NextResponse.json({ error: 'NIB authentication request failed', details: err.message }, { status: 502 });
    }

    // --- 6. Generate signature and payment payload ---
    const transactionId = crypto.randomUUID();
    const transactionTime = format(new Date(), 'yyyyMMddHHmmss');
    const callBackURL = `${APP_URL}/api/payment/nib/notify`;

    const signatureString = [
      `accountNo=${ACCOUNT_NO}`,
      `amount=${total}`,
      `callBackURL=${callBackURL}`,
      `companyName=${COMPANY_NAME}`,
      `Key=${NIB_PAYMENT_KEY}`,
      `token=${tokenForPayload}`,
      `transactionId=${transactionId}`,
      `transactionTime=${transactionTime}`,
    ].join('&');
    
    const signature = crypto.createHash('sha256').update(signatureString, 'utf8').digest('hex');
    
    const payload = {
      accountNo: ACCOUNT_NO,
      amount: String(total),
      callBackURL,
      companyName: COMPANY_NAME,
      token: tokenForPayload,
      transactionId,
      transactionTime,
      signature: signature,
    };

    // --- 7. Create EventPayment record in our DB ---
    const eventPayment = await prisma.eventPayment.create({
      data: {
        amount: total,
        method: 'GATEWAY',
        status: 'PENDING',
        sessionId: null, // Session ID will be saved after the call
        transactionId, // Our internal transaction ID
        pendingOrderId: pendingOrder.id,
        eventId: pendingOrder.eventId,
      },
    });
    console.log('[NIB INITIATE] EventPayment record created:', eventPayment.id);

    // --- 8. Call NIB Payment API with the temporary NIB token ---
    console.log('[NIB INITIATE] Calling NIB Payment API...');
    let responseData: any;
    try {
      const response = await fetch(NIB_PAYMENT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${nibToken}`, // Use the temporary token from NIB auth
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log('[NIB INITIATE] NIB payment raw response:', responseText);

      if (!response.ok) {
        return NextResponse.json({ error: 'NIB payment request failed', status: response.status, details: responseText }, { status: 502 });
      }

      if (!responseText) {
          return NextResponse.json({ error: 'NIB payment response was empty.' }, { status: 502 });
      }

      responseData = JSON.parse(responseText);
      if (!responseData.token) {
        return NextResponse.json({ error: 'NIB payment response is invalid, "token" field missing.', raw: responseText }, { status: 502 });
      }
    } catch (err: any) {
      console.error('[NIB INITIATE] Payment request execution failed:', err);
      return NextResponse.json({ error: 'NIB payment request execution failed', details: err.message }, { status: 502 });
    }

    // --- 9. Save NIB's payment token (sessionId) and return it to the frontend ---
    await prisma.eventPayment.update({
      where: { transactionId },
      data: { sessionId: responseData.token },
    });
    console.log('[NIB INITIATE] NIB payment token saved:', responseData.token);

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
