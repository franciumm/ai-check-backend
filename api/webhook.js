import clientPromise from '../lib/mongodb.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const event = req.body;

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
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
