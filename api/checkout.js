import Whop from "@whop/sdk";
import crypto from "crypto";

import clientPromise from '../lib/mongodb.js';
import { checkRateLimit } from '../lib/rateLimit.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown-ip';
  const isAllowed = await checkRateLimit(`chk_${ip}`, 5, 60);
  if (!isAllowed) {
      return res.status(429).json({ error: 'Too many checkout requests. Please wait a minute.' });
  }

  try {
    const client = new Whop({ apiKey: process.env.WHOP_API_KEY });
    const licenseKey = crypto.randomUUID();

    // Pre-stage in MongoDB with 0 credits
    const mongoClient = await clientPromise;
    const db = mongoClient.db('aicheck');
    await db.collection('licenses').insertOne({
        key: licenseKey,
        credits: 0,
        createdAt: new Date()
    });

    const checkout = await client.checkoutConfigurations.create({
      plan: {
        title: "AI Fighter Deep Scans (800 credits)",
        plan_type: "one_time",
        initial_price: 5.0,
        currency: "usd",
      },
      custom_fields: {
        license_key: licenseKey
      },
      success_url: `https://ai-check-backend.vercel.app/api/success?key=${licenseKey}`
    });

    // Redirect user directly to the Whop checkout page
    res.redirect(303, checkout.purchase_url);

  } catch (error) {
    console.error("Whop checkout error:", error);
    return res.status(500).json({ error: error.message });
  }
}
