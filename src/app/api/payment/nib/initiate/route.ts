'use server';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { format } from 'date-fns';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { total, authToken, eventId, selectedTickets, attendeeDetails, promoCode } = body;

    // Get environment variables from server-side
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

    // NIB Payment Gateway Implementation - Step 3
    // Generate transaction ID and timestamp as required by NIB payment gateway
    const transactionId = crypto.randomUUID();
    const transactionTime = format(new Date(), 'yyyyMMddHHmmss');
    const callBackURL = `${APP_URL}/api/payment/nib/notify`;

    // Create signature string for data integrity checking using SHA256 hashing algorithm
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

    // Generate SHA256 signature for data integrity
    const signature = crypto.createHash('sha256').update(signatureString, 'utf8').digest('hex');

    // Prepare payload for NIB payment gateway request
    const payload = {
      accountNo: ACCOUNT_NO,
      amount: String(total),
      callBackURL: callBackURL,
      companyName: COMPANY_NAME,
      token: authToken,
      transactionId: transactionId,
      transactionTime: transactionTime,
      signature: signature
    };

    // Send request to NIB payment gateway to receive money from customer
    const response = await fetch(NIB_PAYMENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok || !responseData.token) {
      return NextResponse.json(
        { 
          error: responseData.detail || responseData.error || "Failed to get payment token from gateway.",
          status: response.status 
        },
        { status: response.status }
      );
    }

    // Return payment token and transaction ID
    return NextResponse.json({
      success: true,
      paymentToken: responseData.token,
      transactionId: transactionId,
      payload: payload // For debugging purposes
    });

  } catch (error: any) {
    console.error('Payment initiation error:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred during payment initiation.' },
      { status: 500 }
    );
  }
}
