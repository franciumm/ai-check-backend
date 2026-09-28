export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { adminSecret, credits = 800 } = req.body;

  if (adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken) {
    return res.status(500).json({ error: 'KV database not configured' });
  }

  // Generate a random license key (UUID v4 style fallback)
  const licenseKey = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  // Set credits in Vercel KV
  const kvResponse = await fetch(`${kvUrl}/set/credits:${licenseKey}/${credits}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${kvToken}` }
  });

  if (!kvResponse.ok) {
    return res.status(500).json({ error: 'Failed to create license key in KV' });
  }

  return res.status(200).json({
    message: 'License key created successfully',
    licenseKey: licenseKey,
    credits: credits
  });
}
