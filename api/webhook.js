import { unwrapWebhook } from '@whop/sdk/helpers';
import clientPromise from '../lib/mongodb.js';
import { CREDITS_PER_PURCHASE } from '../lib/constants.js';

// Disable default body parser so we can get the raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. Get the raw body as a string
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');

  // 2. Get the required headers
  const headers = {
    "webhook-id": req.headers["webhook-id"],
    "webhook-timestamp": req.headers["webhook-timestamp"],
    "webhook-signature": req.headers["webhook-signature"],
  };

  const secret = process.env.WHOP_WEBHOOK_SECRET;
  
  if (!secret) {
    console.error("Missing WHOP_WEBHOOK_SECRET environment variable");
    return res.status(500).json({ error: "Server configuration error" });
  }

  let event;
  try {
    // 3. Verify. Whop signs with the literal `ws_` secret bytes; unwrapWebhook encodes
    // it the way standardwebhooks expects (passing it raw to `new Webhook` throws).
    event = unwrapWebhook(rawBody, { headers, key: secret });
  } catch (err) {
    console.error("Verification failed:", err);
    return res.status(400).json({ error: "Invalid signature" });
  }

  try {
    // Check if it's a payment success event (`type` in current payloads, `action` in legacy ones)
    const eventType = event.type ?? event.action;
    if (eventType === 'payment.succeeded') {
      const payment = event.data || {};
      const licenseKey = payment.metadata?.license_key
        ?? payment.checkout_configuration?.metadata?.license_key
        ?? payment.custom_fields?.license_key;

      if (!licenseKey) {
        console.error("Webhook received but no license key found in payment metadata");
        return res.status(200).json({ status: 'Ignored - no license key' });
      }

      const client = await clientPromise;
      const db = client.db('aicheck');

      // Whop retries deliveries; record the payment id so a retry can't credit twice.
      // The key is pre-staged at checkout, so no upsert.
      const paymentId = payment.id || req.headers["webhook-id"];
      const result = await db.collection('licenses').updateOne(
        { key: licenseKey, paidPaymentIds: { $ne: paymentId } },
        {
          $inc: { credits: CREDITS_PER_PURCHASE },
          $addToSet: { paidPaymentIds: paymentId },
          $set: { updatedAt: new Date() }
        }
      );

      if (result.matchedCount === 0) {
        console.warn(`No credit applied for ${licenseKey}: unknown key or payment ${paymentId} already applied`);
      } else {
        console.log(`Activated license key ${licenseKey} with ${CREDITS_PER_PURCHASE} credits in MongoDB`);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
