export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const event = req.body;

    // Check if it's a payment success event
    if (event.action === 'payment.succeeded') {
      // Try to extract license key from custom fields
      let licenseKey = null;
      
      // Whop payload structure varies, check custom_fields
      if (event.data && event.data.custom_fields && event.data.custom_fields.license_key) {
         licenseKey = event.data.custom_fields.license_key;
      }
      
      if (!licenseKey) {
        console.error("Webhook received but no license key found in custom_fields");
        return res.status(200).json({ status: 'Ignored - no license key' });
      }

      const kvUrl = process.env.KV_REST_API_URL;
      const kvToken = process.env.KV_REST_API_TOKEN;
      
      if (kvUrl && kvToken) {
        // Add 800 credits to the key
        await fetch(`${kvUrl}/set/credits:${licenseKey}/800`, {
           method: 'POST',
           headers: { Authorization: `Bearer ${kvToken}` }
        });
        console.log(`Activated license key ${licenseKey} with 800 credits`);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
