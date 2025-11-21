
'use server';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { format } from 'date-fns';
import { headers } from 'next/headers';
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

    // --- 2. Get SuperApp token from the request header ---
    const headerList = headers();
    const authHeader = headerList.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
       console.error('[NIB INITIATE] Error: SuperApp authorization token not found in header.');
      return NextResponse.json({ error: 'SuperApp authorization token not found in header.' }, { status: 401 });
    }
    const superAppToken = authHeader.substring(7);
     console.log('[NIB INITIATE] Using token from header:', superAppToken);


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
    console.log('[NIB INITIATE] Dynamically fetched Account No:', ACCOUNT_NO);


    // --- 4. Load required environment variables ---
    const COMPANY_NAME = process.env.NIB_COMPANY_NAME;
    const NIB_PAYMENT_KEY = process.env.NIB_PAYMENT_KEY;
    const NIB_PAYMENT_URL = process.env.NIB_PAYMENT_URL;
    const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;

    if (!COMPANY_NAME || !NIB_PAYMENT_KEY || !NIB_PAYMENT_URL || !APP_URL) {
      return NextResponse.json({ error: 'Server is missing required NIB payment environment variables.' }, { status: 500 });
    }
    console.log('[NIB INITIATE] Environment Variables:', {
        COMPANY_NAME,
        NIB_PAYMENT_KEY_EXISTS: !!NIB_PAYMENT_KEY,
        NIB_PAYMENT_URL,
        APP_URL
    });


    // --- 5. Generate signature and payment payload ---
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
    console.log('[NIB INITIATE] String for signature generation:', signatureString);
    
    const signature = crypto.createHash('sha256').update(signatureString, 'utf8').digest('hex');
    console.log('[NIB INITIATE] Generated Signature:', signature);
    
    const payload = {
      accountNo: ACCOUNT_NO,
      amount: String(total),
      callBackURL,
      companyName: COMPANY_NAME,
      token: superAppToken,
      transactionId,
      transactionTime,
      signature: signature,
    };
     console.log('[NIB INITIATE] Payload to be sent to NIB:', payload);

    // --- 6. Create EventPayment record in our DB ---
    const eventPayment = await prisma.eventPayment.create({
      data: {
        amount: total,
        method: 'GATEWAY',
        status: 'PENDING',
        sessionId: null, // Session ID will be saved after the call
        transactionId, // Our internal transaction ID for this payment attempt
        pendingOrderId: pendingOrder.id,
        eventId: pendingOrder.eventId,
      },
    });
    console.log('[NIB INITIATE] Created EventPayment record with ID:', eventPayment.id);

    // --- 7. Call NIB Payment API with the SuperApp token ---
    console.log('[NIB INITIATE] Calling NIB API at:', NIB_PAYMENT_URL);
    console.log('[NIB INITIATE] Headers being sent to NIB:', {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAppToken}`
    });
    let responseData: any;
    try {
      const response = await fetch(NIB_PAYMENT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAppToken}`, // Use the SuperApp token for authentication
        },
        body: JSON.stringify(payload),
      });

      console.log('[NIB INITIATE] NIB API Response Status:', response.status);
      const responseText = await response.text();

      if (!responseText) {
          console.error("[NIB INITIATE] NIB payment response was empty.");
          return NextResponse.json({ error: 'NIB payment response was empty.' }, { status: 502 });
      }
      console.log('[NIB INITIATE] NIB payment raw response:', responseText);

      if (!response.ok) {
        return NextResponse.json({ error: 'NIB payment request failed', status: response.status, details: responseText }, { status: 502 });
      }

      responseData = JSON.parse(responseText);

      if (!responseData.token) {
        return NextResponse.json({ error: 'NIB payment response is invalid, "token" field missing.', raw: responseText }, { status: 502 });
      }
    } catch (err: any) {
      console.error('[NIB INITIATE] Payment request execution failed:', err);
      return NextResponse.json({ error: 'NIB payment request execution failed', details: err.message }, { status: 502 });
    }

    // --- 8. Save NIB's payment token (sessionId) and return it to the frontend ---
    await prisma.eventPayment.update({
      where: { id: eventPayment.id },
      data: { sessionId: responseData.token },
    });
    console.log('[NIB INITIATE] NIB payment token (sessionId) saved:', responseData.token);

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
