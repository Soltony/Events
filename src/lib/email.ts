'use server';

import nodemailer from 'nodemailer';

interface SendTempPasswordParams {
  email: string;
  phoneNumber: string;
  tempPassword: string;
}

interface SendPendingEventNotificationParams {
  adminEmail: string;
  eventName: string;
  organizerName: string;
  eventDate: string;
  eventId: number;
}

interface SendGiftReceivedNotificationParams {
  email: string;
  recipientName: string;
  buyerName: string | null;
  eventName: string;
  ticketTypeName: string;
  quantity: number;
}

interface SendGiftPurchaseConfirmationParams {
  email: string;
  recipientName: string;
  eventName: string;
  ticketTypeName: string;
  quantity: number;
}

// 🔹 Create reusable transporter
function createTransporter() {
  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_PORT = process.env.SMTP_PORT;
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP environment variables are not fully configured.');
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false, // ⚠️ ONLY for development (remove in production)
    },
  });
}

// 🔹 Send Pending Event Notification
export async function sendPendingEventNotification(
  params: SendPendingEventNotificationParams
) {
  const { adminEmail, eventName, organizerName, eventDate, eventId } = params;

  const EMAIL_FROM = process.env.EMAIL_FROM;
  const APP_URL =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:9002';

  if (!EMAIL_FROM) {
    console.error('EMAIL_FROM is not configured.');
    return;
  }

  try {
    const transporter = createTransporter();

    const reviewLink = `${APP_URL}/dashboard/events/${eventId}`;

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: adminEmail,
      subject: `New Event Pending Approval: ${eventName}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #864b20;">New Event Approval Required</h2>
          <p>A new event has been created and is waiting for your review.</p>

          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px;">
            <p><strong>Event:</strong> ${eventName}</p>
            <p><strong>Organizer:</strong> ${organizerName}</p>
            <p><strong>Date:</strong> ${eventDate}</p>
          </div>

          <p style="margin-top:20px;">
            <a href="${reviewLink}" style="background:#f6b313;padding:10px 15px;border-radius:5px;text-decoration:none;">
              Review Event
            </a>
          </p>

          <p style="font-size: 12px; color: #777;">
            NibTera Tickets
          </p>
        </div>
      `,
    });

    console.log(`✅ Pending event email sent to ${adminEmail}`);
  } catch (error) {
    console.error('❌ Failed to send pending event email:', error);
    // Do NOT throw → don't break event creation
  }
}

// 🔹 Send Temporary Password
export async function sendTempPassword(params: SendTempPasswordParams) {
  const { email, phoneNumber, tempPassword } = params;

  const EMAIL_FROM = process.env.EMAIL_FROM;
  const APP_URL =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:9002';

  if (!EMAIL_FROM) {
    throw new Error('EMAIL_FROM is not configured.');
  }

  try {
    const transporter = createTransporter();

    const loginLink = `${APP_URL}/login`;

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: 'Your Account Credentials for NibTera Tickets',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2 style="color: #864b20;">Welcome!</h2>

          <p>Your account has been created.</p>

          <p><strong>Phone:</strong> ${phoneNumber}</p>
          <p><strong>Password:</strong> 
            <span style="font-size:16px;font-weight:bold;">
              ${tempPassword}
            </span>
          </p>

          <p>You will be required to change this password on first login.</p>

          <a href="${loginLink}" style="background:#f6b313;padding:10px 15px;border-radius:5px;text-decoration:none;">
            Login
          </a>

          <p style="font-size: 12px; color: #777;">
            If you didn’t request this, ignore this email.
          </p>
        </div>
      `,
    });

    console.log(`✅ Temp password email sent to ${email}`);
  } catch (error) {
    console.error('❌ Failed to send temp password email:', error);

    // 🔥 Important fallback (so your system doesn't break)
    return {
      success: false,
      message: 'Email failed, but user created.',
      tempPassword, // you can show this in UI (securely)
    };
  }

  return {
    success: true,
  };
}

// 🔹 Notify a recipient that a ticket was gifted to them
export async function sendGiftReceivedNotification(params: SendGiftReceivedNotificationParams) {
  const { email, recipientName, buyerName, eventName, ticketTypeName, quantity } = params;

  const EMAIL_FROM = process.env.EMAIL_FROM;
  const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

  if (!EMAIL_FROM) {
    console.error('EMAIL_FROM is not configured.');
    return;
  }

  try {
    const transporter = createTransporter();
    const ticketsLink = `${APP_URL}/tickets`;

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: `🎁 You've received a gifted ticket to ${eventName}!`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #864b20;">You've got a gift, ${recipientName}!</h2>
          <p>${buyerName ? `<strong>${buyerName}</strong> has` : 'Someone has'} gifted you ${quantity > 1 ? `${quantity} tickets` : 'a ticket'} to <strong>${eventName}</strong> (${ticketTypeName}).</p>
          <p style="margin-top:20px;">
            <a href="${ticketsLink}" style="background:#f6b313;padding:10px 15px;border-radius:5px;text-decoration:none;">
              View My Tickets
            </a>
          </p>
          <p style="font-size: 12px; color: #777;">
            NibTera Tickets
          </p>
        </div>
      `,
    });

    console.log(`✅ Gift received email sent to ${email}`);
  } catch (error) {
    console.error('❌ Failed to send gift received email:', error);
    // Do NOT throw → notification failure must not affect the completed purchase.
  }
}

// 🔹 Confirm to the purchaser that their gift was sent
export async function sendGiftPurchaseConfirmation(params: SendGiftPurchaseConfirmationParams) {
  const { email, recipientName, eventName, ticketTypeName, quantity } = params;

  const EMAIL_FROM = process.env.EMAIL_FROM;

  if (!EMAIL_FROM) {
    console.error('EMAIL_FROM is not configured.');
    return;
  }

  try {
    const transporter = createTransporter();

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: `Your gift to ${recipientName} is on its way!`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #864b20;">Ticket gifted successfully!</h2>
          <p>${quantity > 1 ? `${quantity} tickets` : 'A ticket'} to <strong>${eventName}</strong> (${ticketTypeName}) ${quantity > 1 ? 'have' : 'has'} been sent to <strong>${recipientName}</strong>.</p>
          <p style="font-size: 12px; color: #777;">
            NibTera Tickets
          </p>
        </div>
      `,
    });

    console.log(`✅ Gift purchase confirmation email sent to ${email}`);
  } catch (error) {
    console.error('❌ Failed to send gift purchase confirmation email:', error);
    // Do NOT throw → notification failure must not affect the completed purchase.
  }
}