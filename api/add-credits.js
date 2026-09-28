import clientPromise from '../lib/mongodb.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { adminSecret, credits = 800 } = req.body;

  if (adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const client = await clientPromise;
  const db = client.db('aicheck');

  // Generate a random license key (UUID v4 style fallback)
  const licenseKey = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  // Set credits in MongoDB
  await db.collection('licenses').insertOne({
    key: licenseKey,
    credits: credits,
    createdAt: new Date()
  });

  return res.status(200).json({
    message: 'License key created successfully',
    licenseKey: licenseKey,
    credits: credits
  });
}
