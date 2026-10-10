// Server-only helper. Deliberately NOT a 'use server' module: it must never be callable
// from the browser as a server action (it sends SMS under the bank's sender ID).

// Provider-agnostic SMS sender. No gateway has been chosen yet, so this
// stub logs the message and reports failure until SMS_API_URL/SMS_API_KEY
// are configured. Swap the fetch body below for the real provider's
// request shape once one is picked (e.g. AfroMessage, Twilio, Geez SMS).
export async function sendSms(phoneNumber: string, message: string): Promise<{ success: boolean; message?: string }> {
  const apiUrl = process.env.SMS_API_URL;
  const apiKey = process.env.SMS_API_KEY;

  if (!apiUrl || !apiKey) {
    console.log(`[SMS STUB] To: ${phoneNumber} | Message: ${message}`);
    return { success: false, message: 'SMS provider not configured.' };
  }

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        to: phoneNumber,
        message,
        senderId: process.env.SMS_SENDER_ID,
      }),
    });
    if (!res.ok) {
      throw new Error(`SMS provider responded with status ${res.status}`);
    }
    return { success: true };
  } catch (error: any) {
    console.error('Failed to send SMS:', error);
    return { success: false, message: error.message };
  }
}
