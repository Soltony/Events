// Server-only mail helpers. Deliberately NOT a 'use server' module: these functions
// must never be exposed to the browser as callable server actions.
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

export type SendTempPasswordResult = { success: true } | { success: false; message: string };

/** Message shown to administrators when a credentials email could not be delivered. */
export const TEMP_PASSWORD_EMAIL_FAILED_MESSAGE =
  'The account was saved, but the credentials email could not be sent. Use "Reset password" to issue a new temporary password once email delivery is working.';

/** Escapes user-controlled values interpolated into email HTML. */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Prevents header injection through user-controlled values in subjects. */
function headerSafe(value: unknown): string {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getAppUrl() {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
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
      // Verify the SMTP server certificate by default. Accepting self-signed /
      // unverifiable certs must be an explicit local-dev opt-in.
      rejectUnauthorized: process.env.SMTP_ALLOW_SELF_SIGNED !== 'true',
    },
    // Message content is always inline HTML built here; never let it pull in local
    // files or remote URLs.
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

// 🔹 Send Pending Event Notification
export async function sendPendingEventNotification(
  params: SendPendingEventNotificationParams
) {
  const { adminEmail, eventName, organizerName, eventDate, eventId } = params;

  const EMAIL_FROM = process.env.EMAIL_FROM;

  if (!EMAIL_FROM) {
    console.error('EMAIL_FROM is not configured.');
    return;
  }

  try {
    const transporter = createTransporter();

    const reviewLink = `${getAppUrl()}/dashboard/events/${encodeURIComponent(String(eventId))}`;

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: adminEmail,
      subject: headerSafe(`New Event Pending Approval: ${eventName}`),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #864b20;">New Event Approval Required</h2>
          <p>A new event has been created and is waiting for your review.</p>

          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px;">
            <p><strong>Event:</strong> ${escapeHtml(eventName)}</p>
            <p><strong>Organizer:</strong> ${escapeHtml(organizerName)}</p>
            <p><strong>Date:</strong> ${escapeHtml(eventDate)}</p>
          </div>

          <p style="margin-top:20px;">
            <a href="${escapeHtml(reviewLink)}" style="background:#f6b313;padding:10px 15px;border-radius:5px;text-decoration:none;">
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
    console.error('❌ Failed to send pending event email:', errorMessage(error));
    // Do NOT throw → don't break event creation
  }
}

// 🔹 Send Temporary Password
// Never returns, logs or otherwise exposes the password: on failure the caller gets a
// generic message and the administrator must issue a fresh password via "Reset password".
export async function sendTempPassword(params: SendTempPasswordParams): Promise<SendTempPasswordResult> {
  const { email, phoneNumber, tempPassword } = params;

  const EMAIL_FROM = process.env.EMAIL_FROM;
  if (!EMAIL_FROM) {
    console.error('❌ Temp password email not sent: EMAIL_FROM is not configured.');
    return { success: false, message: TEMP_PASSWORD_EMAIL_FAILED_MESSAGE };
  }

  try {
    const transporter = createTransporter();

    const loginLink = `${getAppUrl()}/login`;

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: 'Your Account Credentials for NibTera Tickets',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2 style="color: #864b20;">Welcome!</h2>

          <p>Your account has been created.</p>

          <p><strong>Phone:</strong> ${escapeHtml(phoneNumber)}</p>
          <p><strong>Password:</strong>
            <span style="font-size:16px;font-weight:bold;">
              ${escapeHtml(tempPassword)}
            </span>
          </p>

          <p>You will be required to change this password on first login.</p>

          <a href="${escapeHtml(loginLink)}" style="background:#f6b313;padding:10px 15px;border-radius:5px;text-decoration:none;">
            Login
          </a>

          <p style="font-size: 12px; color: #777;">
            If you didn’t request this, ignore this email.
          </p>
        </div>
      `,
    });

    console.log(`✅ Temp password email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to send temp password email:', errorMessage(error));
    return { success: false, message: TEMP_PASSWORD_EMAIL_FAILED_MESSAGE };
  }
}

// 🔹 Notify a recipient that a ticket was gifted to them
export async function sendGiftReceivedNotification(params: SendGiftReceivedNotificationParams) {
  const { email, recipientName, buyerName, eventName, ticketTypeName, quantity } = params;

  const EMAIL_FROM = process.env.EMAIL_FROM;

  if (!EMAIL_FROM) {
    console.error('EMAIL_FROM is not configured.');
    return;
  }

  try {
    const transporter = createTransporter();
    const ticketsLink = `${getAppUrl()}/tickets`;
    const qty = Number(quantity) || 1;

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: headerSafe(`🎁 You've received a gifted ticket to ${eventName}!`),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #864b20;">You've got a gift, ${escapeHtml(recipientName)}!</h2>
          <p>${buyerName ? `<strong>${escapeHtml(buyerName)}</strong> has` : 'Someone has'} gifted you ${qty > 1 ? `${qty} tickets` : 'a ticket'} to <strong>${escapeHtml(eventName)}</strong> (${escapeHtml(ticketTypeName)}).</p>
          <p style="margin-top:20px;">
            <a href="${escapeHtml(ticketsLink)}" style="background:#f6b313;padding:10px 15px;border-radius:5px;text-decoration:none;">
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
    console.error('❌ Failed to send gift received email:', errorMessage(error));
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
    const qty = Number(quantity) || 1;

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: headerSafe(`Your gift to ${recipientName} is on its way!`),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #864b20;">Ticket gifted successfully!</h2>
          <p>${qty > 1 ? `${qty} tickets` : 'A ticket'} to <strong>${escapeHtml(eventName)}</strong> (${escapeHtml(ticketTypeName)}) ${qty > 1 ? 'have' : 'has'} been sent to <strong>${escapeHtml(recipientName)}</strong>.</p>
          <p style="font-size: 12px; color: #777;">
            NibTera Tickets
          </p>
        </div>
      `,
    });

    console.log(`✅ Gift purchase confirmation email sent to ${email}`);
  } catch (error) {
    console.error('❌ Failed to send gift purchase confirmation email:', errorMessage(error));
    // Do NOT throw → notification failure must not affect the completed purchase.
  }
}
