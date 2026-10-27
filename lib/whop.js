import { WhopClient } from "@whop/sdk";
import crypto from "crypto";

import clientPromise from './mongodb.js';
import { CREDITS_PER_PURCHASE } from './constants.js';

const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://ai-check-backend.vercel.app';

// Whop rejects inline plan titles longer than 30 characters
const PLAN_TITLE = `AI Fighter: ${CREDITS_PER_PURCHASE} Deep Scans`.slice(0, 30);

/**
 * Creates a Whop checkout for a new license key, then stores the key with 0 credits.
 * The key travels in checkout metadata, which Whop copies onto the payment,
 * so the payment.succeeded webhook can credit it.
 */
export async function createLicenseCheckout() {
  // @whop/sdk v2 authenticates with `token`, not `apiKey`
  const client = new WhopClient({ token: process.env.WHOP_API_KEY });
  const licenseKey = crypto.randomUUID();

  const checkout = await client.checkoutConfigurations.create({
    plan: {
      title: PLAN_TITLE,
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

  // Stored only once Whop accepted the checkout, so failed calls leave no orphan keys.
  // The webhook can't fire before this: it needs the buyer to pay on purchase_url first.
  const mongoClient = await clientPromise;
  await mongoClient.db('aicheck').collection('licenses').insertOne({
    key: licenseKey,
    credits: 0,
    createdAt: new Date()
  });

  return { checkoutUrl: checkout.purchase_url, licenseKey };
}
