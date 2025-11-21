
'use server';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { format } from 'date-fns';
import { headers } from 'next/headers';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // --- 1. Parse request body and get SuperApp token from header ---
    const body = await req.json();
    console.log('[NIB INITIATE] Received body:', body);

    const { total, transactionId: pendingOrderTransactionId } = body;
    if (!total || !pendingOrderTransactionId) {
      return NextResponse.json({ error: 'Total amount and transaction ID are required.' }, { status: 400 });
    }
    
    const headerList = headers();
    const authHeader = headerList.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[NIB INITIATE] Error: SuperApp authorization token not found in header.');
      return NextResponse.json({ error: 'SuperApp authorization token not found in header.' }, { status: 401 });
    }
    const superAppToken = authHeader.substring(7);
    console.log('[NIB INITIATE] Found SuperApp Token in header.');

    // --- 2. Load required environment variables ---
    const COMPANY_NAME = process.env.NIB_COMPANY_NAME;
    const NIB_PAYMENT_KEY = process.env.NIB_PAYMENT_KEY;
    const NIB_PAYMENT_URL = process.env.NIB_PAYMENT_URL;
    const VALIDATE_TOKEN_URL = process.env.VALIDATE_TOKEN_URL;
    const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;

    if (!COMPANY_NAME || !NIB_PAYMENT_KEY || !NIB_PAYMENT_URL || !VALIDATE_TOKEN_URL || !APP_URL) {
      console.error('[NIB INITIATE] Server is missing required NIB payment environment variables.');
      return NextResponse.json({ error: 'Server is missing required NIB payment environment variables.' }, { status: 500 });
    }

    // --- 3. Validate token with NIB before payment ---
    console.log('[NIB INITIATE] Step 3: Validating token with NIB at:', VALIDATE_TOKEN_URL);
    try {
      const validationResponse = await fetch(VALIDATE_TOKEN_URL, {
        method: 'GET',
        headers: { Authorization: `Bearer ${superAppToken}`, Accept: 'application/json' },
        cache: 'no-store',
      });
      console.log('[NIB INITIATE] Token validation response status:', validationResponse.status);
      const validationText = await validationResponse.text();
      console.log('[NIB INITIATE] Token validation response text:', validationText);

      if (!validationResponse.ok) {
        throw new Error(`Token validation failed with status ${validationResponse.status}: ${validationText}`);
      }
      const validationData = JSON.parse(validationText);
      if (!validationData.phone) {
        throw new Error('Phone number not found in token validation response.');
      }
      console.log('[NIB INITIATE] Token validated successfully for phone:', validationData.phone);
    } catch (err: any) {
        console.error('[NIB INITIATE] Error during token validation step:', err.message);
        return NextResponse.json({ error: 'Failed to validate SuperApp token with NIB.', details: err.message }, { status: 401 });
    }

    // --- 4. Fetch pending order and event to get the destination account ---
    const pendingOrder = await prisma.pendingOrder.findUnique({
      where: { transactionId: pendingOrderTransactionId },
      include: { event: true },
    });

    if (!pendingOrder || !pendingOrder.event?.nibBankAccount) {
      return NextResponse.json({ error: 'Missing event or bank account information for the order.' }, { status: 404 });
    }
    const ACCOUNT_NO = pendingOrder.event.nibBankAccount;
    console.log('[NIB INITIATE] Dynamically fetched Account No:', ACCOUNT_NO);

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
    const signature = crypto.createHash('sha256').update(signatureString, 'utf8').digest('hex');
    
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
        sessionId: null,
        transactionId,
        pendingOrderId: pendingOrder.id,
        eventId: pendingOrder.eventId,
      },
    });
    console.log('[NIB INITIATE] Created EventPayment record with ID:', eventPayment.id);

    // --- 7. Call NIB Payment API ---
    console.log('[NIB INITIATE] Calling NIB API at:', NIB_PAYMENT_URL);
    let responseData: any;
    try {
      const response = await fetch(NIB_PAYMENT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superAppToken}` },
        body: JSON.stringify(payload),
      });

      console.log('[NIB INITIATE] NIB API Response Status:', response.status);
      const responseText = await response.text();
      console.log('[NIB INITIATE] NIB payment raw response:', responseText);

      if (!responseText) {
          console.error("[NIB INITIATE] NIB payment response was empty.");
          throw new Error('NIB payment response was empty.');
      }
      
      if (!response.ok) {
        throw new Error(`NIB payment request failed with status ${response.status}: ${responseText}`);
      }

      responseData = JSON.parse(responseText);

      if (!responseData.token) {
        throw new Error('NIB payment response is invalid, "token" field missing.');
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
