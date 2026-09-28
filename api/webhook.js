import { Webhook } from 'standardwebhooks';
import clientPromise from '../lib/mongodb.js';

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
    // 3. Initialize and verify
    const wh = new Webhook(secret);
    event = wh.verify(rawBody, headers);
  } catch (err) {
    console.error("Verification failed:", err);
    return res.status(400).json({ error: "Invalid signature" });
  }

  try {
    // Check if it's a payment success event
    if (event.action === 'payment.succeeded') {
      let licenseKey = null;
      
      if (event.data && event.data.custom_fields && event.data.custom_fields.license_key) {
         licenseKey = event.data.custom_fields.license_key;
      }
      
      if (!licenseKey) {
        console.error("Webhook received but no license key found in custom_fields");
        return res.status(200).json({ status: 'Ignored - no license key' });
      }

      const client = await clientPromise;
      const db = client.db('aicheck');
      
      await db.collection('licenses').updateOne(
        { key: licenseKey },
        { $inc: { credits: 800 }, $set: { updatedAt: new Date() } },
        { upsert: true }
      );
      
      console.log(`Activated license key ${licenseKey} with 800 credits in MongoDB`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
