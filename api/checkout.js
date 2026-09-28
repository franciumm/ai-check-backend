import Whop from "@whop/sdk";
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const client = new Whop({ apiKey: process.env.WHOP_API_KEY });
    const licenseKey = crypto.randomUUID();

    // Pre-stage in Vercel KV with 0 credits
    const kvUrl = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;
    if (kvUrl && kvToken) {
       await fetch(`${kvUrl}/set/credits:${licenseKey}/0`, {
         method: 'POST',
         headers: { Authorization: `Bearer ${kvToken}` }
       });
    }

    const checkout = await client.checkoutConfigurations.create({
      plan: {
        title: "AI Check Deep Scans (800 credits)",
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
