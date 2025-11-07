
'use server';

import nodemailer from 'nodemailer';

interface SendTempPasswordParams {
  email: string;
  phoneNumber: string;
  tempPassword: string;
}

export async function sendTempPassword(params: SendTempPasswordParams) {
  const { email, phoneNumber, tempPassword } = params;

  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_PORT = process.env.SMTP_PORT;
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;
  const EMAIL_FROM = process.env.EMAIL_FROM;
  const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !EMAIL_FROM) {
    console.error('SMTP environment variables are not fully configured.');
    // In a real application, you might throw an error or handle this more gracefully
    // For this prototype, we'll log the error and continue, but the email won't be sent.
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const loginLink = `${APP_URL}/login`;

  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: "Your Account Credentials for NibTera Tickets",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2 style="color: #864b20;">Welcome to NibTera Tickets!</h2>
          <p>An account has been created for you. Please use the following credentials to sign in.</p>
          <p><strong>Phone Number:</strong> ${phoneNumber}</p>
          <p><strong>Temporary Password:</strong> <b style="font-size: 1.2em;">${tempPassword}</b></p>
          <p>For your security, you will be required to change this password upon your first login.</p>
          <p>
            <a href="${loginLink}" style="background-color: #f6b313; color: #422006; padding: 10px 15px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Click here to Login
            </a>
          </p>
          <p>If you did not request this account, please ignore this email.</p>
          <p>Thank you,<br/>The NibTera Tickets Team</p>
        </div>
      `,
    });

    console.log(`Temporary password email sent to ${email}`);
  } catch (error) {
    console.error('Failed to send temporary password email:', error);
    // Depending on the desired behavior, you might want to re-throw the error
    // to let the calling function know that the email failed to send.
    throw new Error('Failed to send credentials email.');
  }
}
