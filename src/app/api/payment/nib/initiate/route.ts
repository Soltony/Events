import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { format } from 'date-fns';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { centsToAmountString, OrderError, pricePendingOrder, toCents } from '@/lib/orders';
import { withApiErrorHandling } from '@/lib/api-handler';

// Logging policy: never log the SuperApp token, the signature string (it embeds the
// merchant key), request/response payloads, or the NIB payment token. Log only internal
// identifiers, HTTP status codes and timings.

const NIB_TIMEOUT_MS = 60_000;

export const POST = withApiErrorHandling(async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { total: clientTotal, transactionId: pendingOrderTransactionId } = body ?? {};
    if (typeof pendingOrderTransactionId !== 'string' || !pendingOrderTransactionId) {
      return NextResponse.json({ error: 'Transaction ID is required.' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const superAppToken = cookieStore.get('superapp_token')?.value;
    if (!superAppToken) {
      return NextResponse.json({ error: 'User session not found. Please log in through the SuperApp.' }, { status: 401 });
    }

    const pendingOrder = await prisma.pendingOrder.findUnique({
      where: { transactionId: pendingOrderTransactionId },
      include: { event: true },
    });
    if (!pendingOrder || !pendingOrder.event?.nibBankAccount) {
      return NextResponse.json({ error: 'Missing event or bank account information for this order.' }, { status: 404 });
    }
    if (pendingOrder.status !== 'PENDING') {
      return NextResponse.json({ error: 'This order has already been processed.' }, { status: 409 });
    }

    // The amount charged is always computed server-side from database prices.
    const { totalCents } = await pricePendingOrder(prisma, pendingOrder);
    if (totalCents === 0) {
      return NextResponse.json({ error: 'Free ticket orders do not require payment initiation.' }, { status: 400 });
    }
    // The client's displayed total must agree with the server's; otherwise the buyer would
    // be charged an amount they did not see (e.g. a price changed after the page loaded).
    if (clientTotal != null) {
      let clientCents: number | null = null;
      try {
        clientCents = toCents(clientTotal);
      } catch {
        clientCents = null;
      }
      if (clientCents === null || Math.abs(clientCents - totalCents) > 1) {
        return NextResponse.json(
          { error: 'The order total has changed. Please refresh the page and try again.' },
          { status: 409 },
        );
      }
    }
    const amount = centsToAmountString(totalCents);

    const ACCOUNT_NO = pendingOrder.event.nibBankAccount;
    const COMPANY_NAME = process.env.NIB_COMPANY_NAME;
    const NIB_PAYMENT_KEY = process.env.NIB_PAYMENT_KEY;
    const NIB_PAYMENT_URL = process.env.NIB_PAYMENT_URL;
    const callBackURL = process.env.NIB_CALLBACK;
    if (!COMPANY_NAME || !NIB_PAYMENT_KEY || !NIB_PAYMENT_URL || !callBackURL) {
      console.error('[NIB INITIATE] Server is missing required NIB environment variables.');
      return NextResponse.json({ error: 'Payment service is not configured correctly.' }, { status: 500 });
    }

    // Our payment reference. It is only ever sent to NIB (never to the browser) and is
    // echoed back as `txnRef` in the callback.
    const transactionId = crypto.randomUUID();
    const transactionTime = format(new Date(), 'yyyyMMddHHmmss');

    const signatureString = [
      `accountNo=${ACCOUNT_NO}`,
      `amount=${amount}`,
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
      amount,
      callBackURL,
      companyName: COMPANY_NAME,
      token: superAppToken,
      transactionId,
      transactionTime,
      signature,
    };

    const eventPayment = await prisma.eventPayment.create({
      data: {
        amount: totalCents / 100,
        method: 'GATEWAY',
        status: 'PENDING',
        transactionId,
        pendingOrderId: pendingOrder.id,
        eventId: pendingOrder.eventId,
      },
    });

    let paymentToken: string;
    const startedAt = Date.now();
    try {
      const response = await fetch(NIB_PAYMENT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAppToken}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(NIB_TIMEOUT_MS),
      });
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(3);
      console.log(`[NIB INITIATE] payment=${eventPayment.id} status=${response.status} time=${elapsed}s`);

      const responseText = await response.text();
      if (!response.ok) {
        return NextResponse.json({ error: 'NIB payment request failed.' }, { status: 502 });
      }

      let responseData: any = null;
      try {
        responseData = responseText ? JSON.parse(responseText) : null;
      } catch {
        responseData = null;
      }
      if (typeof responseData?.token !== 'string' || !responseData.token) {
        console.error(`[NIB INITIATE] payment=${eventPayment.id} response missing payment token`);
        return NextResponse.json({ error: 'NIB payment response was invalid.' }, { status: 502 });
      }
      paymentToken = responseData.token;
    } catch (err: any) {
      const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      console.error(`[NIB INITIATE] payment=${eventPayment.id} request failed: ${timedOut ? 'timeout' : err?.name || 'error'}`);
      return timedOut
        ? NextResponse.json({ error: 'NIB payment request timed out.' }, { status: 504 })
        : NextResponse.json({ error: 'Could not connect to NIB payment service.' }, { status: 503 });
    }

    // Stored so the callback can be verified against the token NIB issued for this payment.
    await prisma.eventPayment.update({
      where: { id: eventPayment.id },
      data: { sessionId: paymentToken },
    });

    return NextResponse.json({ success: true, paymentToken });
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[NIB INITIATE] Unexpected error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'An unexpected server error occurred.' }, { status: 500 });
  }
});
