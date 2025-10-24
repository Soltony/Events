'use server';

import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  let requestBody;
  try {
    requestBody = await request.json();
  } catch (e) {
    console.error("Callback Error: Invalid JSON in request body.", e);
    return NextResponse.json({ message: "Error Occurred." }, { status: 400 });
  }

  // Step 1: Get Header authorization details and validate token
  const headerList = await headers();
  const authHeader = headerList.get('Authorization');
  
  if (!authHeader) {
    console.error("Authorization header is missing from the request.");
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Authorization header is missing from the request.' 
      },
      { status: 401 }
    );
  }

  if (!authHeader.startsWith('Bearer ')) {
    console.error("Authorization header is malformed.");
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Authorization header is malformed. It must start with Bearer.' 
      },
      { status: 401 }
    );
  }

  const token = authHeader.substring(7);

  // Extract payment completion data from request body
  const {
    paidAmount,
    paidByNumber,
    txnRef,
    transactionId,
    transactionTime,
    accountNo,
    token: receivedToken,
    signature: receivedSignature
  } = requestBody;

  try {
    // Validate that the token in the header matches the token in the body
    if (token !== receivedToken) {
      console.error("Token mismatch between header and body.");
      return NextResponse.json(
        { message: "Token validation failed." },
        { status: 400 }
      );
    }

    // Validate signature for data integrity
    const signatureString = [
      `paidAmount=${paidAmount}`,
      `paidByNumber=${paidByNumber}`,
      `txnRef=${txnRef}`,
      `transactionId=${transactionId}`,
      `transactionTime=${transactionTime}`,
      `accountNo=${accountNo}`,
      `token=${receivedToken}`
    ].join('&');

    const expectedSignature = crypto.createHash('sha256').update(signatureString, 'utf8').digest('hex');

    if (receivedSignature !== expectedSignature) {
      console.error("Signature validation failed.");
      return NextResponse.json(
        { message: "Signature validation failed." },
        { status: 400 }
      );
    }

    // Find the pending order by transaction ID
    const pendingOrder = await prisma.pendingOrder.findUnique({
      where: { transactionId: transactionId }
    });

    if (!pendingOrder) {
      console.error(`Pending order not found for transaction ID: ${transactionId}`);
      return NextResponse.json(
        { message: "Transaction not found." },
        { status: 400 }
      );
    }

    // Update the pending order status to completed
    await prisma.pendingOrder.update({
      where: { transactionId: transactionId },
      data: { 
        status: 'COMPLETED'
      }
    });

    // Create attendee records for each ticket
    const attendeeData = pendingOrder.attendeeData as any;
    
    if (attendeeData && attendeeData.name && attendeeData.phone) {
      // Create a single attendee record
      const attendee = await prisma.attendee.create({
        data: {
          eventId: pendingOrder.eventId,
          ticketTypeId: pendingOrder.ticketTypeId || 1, // Default to first ticket type if not specified
          name: attendeeData.name,
          phoneNumber: attendeeData.phone,
          userId: attendeeData.userId || null
        }
      });

      // Update the pending order with the attendee ID
      await prisma.pendingOrder.update({
        where: { transactionId: transactionId },
        data: { 
          attendeeId: attendee.id
        }
      });

      // Update ticket type sold count
      if (pendingOrder.ticketTypeId) {
        await prisma.ticketType.update({
          where: { id: pendingOrder.ticketTypeId },
          data: {
            sold: {
              increment: 1
            }
          }
        });
      }
    }

    console.log(`Payment completed successfully for transaction ID: ${transactionId}`);
    
    // Return success response
    return NextResponse.json(
      { message: "Payment confirmed and updated." },
      { status: 200 }
    );

  } catch (error: any) {
    console.error("Error processing payment callback:", error);
    return NextResponse.json(
      { message: "Error processing payment." },
      { status: 400 }
    );
  }
}
