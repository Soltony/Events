// app/api/debug/log-token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { paymentToken, transactionId } = await req.json();

    if (!paymentToken || !transactionId) {
      return NextResponse.json({ success: false, error: "Missing token or transactionId" }, { status: 400 });
    }

    // ✅ Log to server console
    console.log(`[DEBUG] Payment token received from frontend for transaction ${transactionId}:`, paymentToken);


    return NextResponse.json({ success: true, message: "Token logged successfully" });
  } catch (err: any) {
    console.error('[DEBUG] Failed to log payment token:', err);
    return NextResponse.json({ success: false, error: err.message || 'Unknown error' }, { status: 500 });
  }
}
