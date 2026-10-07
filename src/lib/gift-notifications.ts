'use server';

import prisma from '@/lib/prisma';
import { sendGiftPurchaseConfirmation, sendGiftReceivedNotification } from '@/lib/email';
import { sendSms } from '@/lib/sms';

interface NotifyGiftPurchaseParams {
  recipientPhone: string;
  buyerId: string | null;
  buyerName: string | null;
  eventName: string;
  ticketTypeName: string;
  quantity: number;
}

// Fires both notifications for a completed gift purchase. Recipients need no account at
// purchase time — this looks them up by phone only opportunistically, for the email/name
// personalization; the SMS always goes out since the phone number is all we ever require.
// Called only after the Attendee rows are actually created (payment already succeeded), so a
// failure here must never surface as a purchase failure — every step is best-effort.
export async function notifyGiftPurchase(params: NotifyGiftPurchaseParams) {
  const { recipientPhone, buyerId, buyerName, eventName, ticketTypeName, quantity } = params;

  try {
    const [recipient, buyer] = await Promise.all([
      prisma.user.findUnique({
        where: { phoneNumber: recipientPhone },
        select: { email: true, firstName: true },
      }),
      buyerId
        ? prisma.user.findUnique({ where: { id: buyerId }, select: { email: true } })
        : Promise.resolve(null),
    ]);

    if (recipient?.email) {
      await sendGiftReceivedNotification({
        email: recipient.email,
        recipientName: recipient.firstName,
        buyerName,
        eventName,
        ticketTypeName,
        quantity,
      });
    }

    await sendSms(
      recipientPhone,
      `You've received ${quantity > 1 ? `${quantity} tickets` : 'a ticket'} for ${eventName}${buyerName ? ` from ${buyerName}` : ''}! Log in with this phone number and check "My Tickets" in the app to view it.`
    );

    if (buyer?.email) {
      await sendGiftPurchaseConfirmation({
        email: buyer.email,
        recipientName: recipient?.firstName ?? 'the recipient',
        eventName,
        ticketTypeName,
        quantity,
      });
    }
  } catch (error) {
    console.error('Failed to send gift notifications:', error);
    // Never throw — notification failure must not affect the completed purchase.
  }
}
