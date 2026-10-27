import crypto from 'crypto';

import clientPromise from '../lib/mongodb.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { adminSecret, credits = 800 } = req.body || {};

  // An unset ADMIN_SECRET must not let a request that omits adminSecret through
  const expected = process.env.ADMIN_SECRET;
  if (!expected || typeof adminSecret !== 'string' ||
      adminSecret.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(adminSecret), Buffer.from(expected))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!Number.isInteger(credits) || credits <= 0) {
    return res.status(400).json({ error: 'credits must be a positive integer' });
  }

  const client = await clientPromise;
  const db = client.db('aicheck');

  const licenseKey = crypto.randomUUID();

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
