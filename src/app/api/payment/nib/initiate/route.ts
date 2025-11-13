
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
    console.log('[NIB INITIATE] Received body:', body);
    const { total, transactionId: pendingOrderTransactionId } = body;

    if (!total || !pendingOrderTransactionId) {
      return NextResponse.json(
        { error: 'Total amount and transaction ID are required.' },
        { status: 400 }
      );
    }

    // --- NEW: Directly check for Authorization header first ---
    const authHeader = req.headers.get('Authorization');
    let authToken: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        authToken = authHeader.substring(7);
        console.log('[NIB INITIATE] Auth token successfully extracted from Authorization header.');
    } else {
        // --- Fallback to session cookie for logged-in users ---
        console.log('[NIB INITIATE] Authorization header not found, attempting to retrieve session cookie...');
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('auth');
        console.log('[NIB INITIATE] Value of session cookie (auth):', sessionCookie?.value);

        if (sessionCookie?.value) {
            console.log('[NIB INITIATE] Session cookie found. Decrypting...');
            const decryptedSession = await decryptSessionPayload(sessionCookie.value);
            const sessionData = JSON.parse(decryptedSession);
            authToken = sessionData.accessToken;
        }
    }

    if (!authToken) {
      console.error('[NIB INITIATE] Error: Auth token could not be found in header or session cookie.');
      return NextResponse.json(
        { error: 'Unauthorized', detail: 'User session not found or auth token is missing.' },
        { status: 401 }
      );
    }
    

    const ACCOUNT_NO = process.env.NIB_ACCOUNT_NO;
    const COMPANY_NAME = process.env.NIB_COMPANY_NAME;
    const NIB_PAYMENT_KEY = process.env.NIB_PAYMENT_KEY;
    const NIB_PAYMENT_URL = process.env.NIB_PAYMENT_URL;
    const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;

    console.log('[NIB INITIATE] Environment Variables:', {
        ACCOUNT_NO,
        COMPANY_NAME,
        NIB_PAYMENT_KEY_EXISTS: !!NIB_PAYMENT_KEY,
        NIB_PAYMENT_URL,
        APP_URL
    });


    if (!ACCOUNT_NO || !COMPANY_NAME || !NIB_PAYMENT_KEY || !NIB_PAYMENT_URL || !APP_URL) {
      console.error('[NIB INITIATE] Error: One or more required payment gateway environment variables are missing.');
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
    console.log('[NIB INITIATE] String for signature generation:', signatureString);


    const signature = crypto.createHash('sha256').update(signatureString, 'utf8').digest('hex');
    console.log('[NIB INITIATE] Generated Signature:', signature);


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
    console.log('[NIB INITIATE] Payload to be sent to NIB:', payload);


    // --- Create EventPayment record in the database ---
    const pendingOrder = await prisma.pendingOrder.findUnique({
      where: { transactionId: pendingOrderTransactionId },
      include: { event: true }
    });

    if (!pendingOrder) {
      console.error(`[NIB INITIATE] Error: Pending order with transaction ID ${pendingOrderTransactionId} not found.`);
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

    console.log(`[NIB INITIATE] Created EventPayment record with ID: ${eventPayment.id}`);


    // --- Call NIB API ---
    const apiHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };
    console.log('[NIB INITIATE] Calling NIB API at:', NIB_PAYMENT_URL);
    console.log('[NIB INITIATE] Headers being sent to NIB:', apiHeaders);

    const response = await fetch(NIB_PAYMENT_URL, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify(payload),
    });

    console.log(`[NIB INITIATE] NIB API Response Status: ${response.status}`);


    if (!response.ok) {
      let errorText = `Failed to get payment token from gateway. Status: ${response.status}`;
      try {
        const errorBody = await response.json();
        console.error('[NIB INITIATE] NIB API Error Body:', errorBody);
        errorText = errorBody.detail || errorBody.error || errorText;
      } catch {}
      return NextResponse.json({ error: errorText, status: response.status }, { status: response.status });
    }

    const responseText = await response.text();
    console.log('[NIB INITIATE] NIB API Response Body:', responseText);

    if (!responseText) {
       console.error('[NIB INITIATE] Error: Received empty response from payment gateway.');
      return NextResponse.json(
        { error: "Received empty response from payment gateway.", status: 502 },
        { status: 502 }
      );
    }

    const responseData = JSON.parse(responseText);

    if (!responseData.token) {
       console.error('[NIB INITIATE] Error: Payment gateway did not return a valid payment token in response.');
      return NextResponse.json(
        { error: "Payment gateway did not return a valid payment token.", status: 502 },
        { status: 502 }
      );
    }
     console.log('[NIB INITIATE] Successfully received payment token from NIB.');


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
    console.error('[NIB INITIATE] Unexpected error in handler:', error);
    return NextResponse.json(
      { error: error.message || 'Unexpected error during payment initiation.' },
      { status: 500 }
    );
  }
}
