import { checkRateLimit } from '../lib/rateLimit.js';
import { createLicenseCheckout } from '../lib/whop.js';

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
    const { checkoutUrl } = await createLicenseCheckout();

    // Redirect user directly to the Whop checkout page
    res.redirect(303, checkoutUrl);

  } catch (error) {
    console.error("Whop checkout error:", error);
    return res.status(500).json({ error: 'Could not start checkout. Please try again later.' });
  }
}
