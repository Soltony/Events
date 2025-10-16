# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Payment Process Overview

The payment process in this project is designed for secure integration with the NIBtera Super App. It uses a combination of client-side communication to trigger the payment interface and server-to-server callbacks (webhooks) to securely confirm transactions.

Here is a step-by-step breakdown of the flow:

1.  **Purchase Initiation (Client-Side)**:
    *   A user selects tickets on an event page and provides their name and phone number.
    *   The browser sends these details to the application's backend to start the payment process.

2.  **Payment Session Request (Your Backend → NIB Gateway)**:
    *   Your backend receives the purchase details.
    *   It creates a `signature` by hashing the transaction details with a secret key (SHA-256 algorithm), ensuring the request is secure and tamper-proof.
    *   It sends this signed payload to the NIB Payment Gateway to request a new payment session.

3.  **Payment Token Generation (NIB Gateway → Your Backend → Client)**:
    *   The NIB Gateway validates the signed request.
    *   Upon success, it returns a single-use `paymentToken` to your backend.
    *   Your backend forwards this `paymentToken` back to the user's browser.

4.  **Super App Hand-off**:
    *   The browser immediately receives the `paymentToken` and uses the `window.myJsChannel.postMessage()` JavaScript interface.
    *   This function securely passes the token to the NIBtera Super App, which takes over and displays its native payment screen to the user.

5.  **Payment Confirmation and Ticket Creation**:
    *   **Webhook Notification**: After the user completes the payment, the NIB Gateway sends a server-to-server notification (webhook) to your backend's callback URL (`/api/payment/arifpay/notify`).
    *   **Backend Processing**: Your backend receives this notification, validates it, marks the order as "COMPLETED" in the database, creates the official `Attendee` record (the ticket), and updates inventory.
    *   **Client-Side Polling**: While the webhook is being processed, the user's browser polls a status endpoint (`/api/payment/status/...`). Once it sees the "COMPLETED" status, it redirects the user to the success page, where they can view and download their ticket QR code.

This dual-confirmation model (webhook + polling) ensures that the transaction is processed reliably, even if there are network delays.
