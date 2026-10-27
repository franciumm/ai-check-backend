import { WhopClient } from "@whop/sdk";
import crypto from "crypto";

import clientPromise from './mongodb.js';
import { CREDITS_PER_PURCHASE } from './constants.js';

const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://ai-check-backend.vercel.app';

/**
 * Pre-stages a license key with 0 credits and creates a Whop checkout for it.
 * The key travels in checkout metadata, which Whop copies onto the payment,
 * so the payment.succeeded webhook can credit it.
 */
export async function createLicenseCheckout() {
  // @whop/sdk v2 authenticates with `token`, not `apiKey`
  const client = new WhopClient({ token: process.env.WHOP_API_KEY });
  const licenseKey = crypto.randomUUID();

  const mongoClient = await clientPromise;
  const db = mongoClient.db('aicheck');
  await db.collection('licenses').insertOne({
    key: licenseKey,
    credits: 0,
    createdAt: new Date()
  });

  const checkout = await client.checkoutConfigurations.create({
    plan: {
      title: `AI Fighter Deep Scans (${CREDITS_PER_PURCHASE} credits)`,
      plan_type: "one_time",
      initial_price: 5.0,
      currency: "usd",
    },
    metadata: {
      license_key: licenseKey
    },
    redirect_url: `${BASE_URL}/api/success?key=${licenseKey}`
  });

  if (!checkout.purchase_url) {
    throw new Error('Whop did not return a purchase URL');
  }

  return { checkoutUrl: checkout.purchase_url, licenseKey };
}
