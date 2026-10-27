import clientPromise from '../lib/mongodb.js';
import { checkRateLimit } from '../lib/rateLimit.js';

/**
 * Vercel Serverless Function: /api/detect
 * Backend endpoint for 'AI Check' Chrome extension.
 *
 * Receives an image URL, analyzes it using the Sightengine genai model,
 * and returns the AI detection score, category label, and generator model breakdown.
 */

/**
 * Validates that a string is a valid HTTP or HTTPS URL.
 * @param {string} urlString
 * @returns {boolean}
 */
function isValidHttpUrl(urlString) {
  if (typeof urlString !== 'string' || !urlString.trim()) {
    return false;
  }
  try {
    const parsed = new URL(urlString.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Maps the Sightengine ai_generated score to a user-friendly label.
 *
 * Scoring threshold mapping:
 * - score < 0.25         → 'Not AI'
 * - 0.25 <= score < 0.75 → 'Possibly AI'
 * - 0.75 <= score < 0.90 → 'Likely AI'
 * - score >= 0.90        → 'Surely AI'
 *
 * @param {number} score
 * @returns {string}
 */
function mapScoreToLabel(score) {
  if (score >= 0.90) {
    return 'Surely AI';
  }
  if (score >= 0.75) {
    return 'Likely AI';
  }
  if (score >= 0.25) {
    return 'Possibly AI';
  }
  return 'Not AI';
}

/**
 * Calls the Sightengine genai model and maps the result.
 * Returns { status, body }; status 200 means body is { score, label, generators }.
 */
async function analyzeWithSightengine(imageUrl, apiUser, apiSecret) {
  // Sightengine expects FormData (NOT JSON)
  const formData = new FormData();
  formData.append('url', imageUrl);
  formData.append('models', 'genai');
  formData.append('api_user', apiUser);
  formData.append('api_secret', apiSecret);

  const sightengineResponse = await fetch('https://api.sightengine.com/1.0/check.json', {
    method: 'POST',
    body: formData,
  });

  if (!sightengineResponse.ok) {
    const errorData = await sightengineResponse.json().catch(() => null);
    const errorMessage =
      errorData?.error?.message ||
      `Sightengine API responded with status ${sightengineResponse.status} (${sightengineResponse.statusText})`;

    return {
      status: sightengineResponse.status >= 400 && sightengineResponse.status < 500 ? 400 : 502,
      body: { error: errorMessage, details: errorData || undefined },
    };
  }

  const data = await sightengineResponse.json();

  // Application-level failure returned by Sightengine
  if (data.status === 'failure') {
    return {
      status: 400,
      body: {
        error: data.error?.message || 'Sightengine analysis failed for the provided image.',
        details: data.error,
      },
    };
  }

  const score = data?.type?.ai_generated;
  if (typeof score !== 'number') {
    return {
      status: 502,
      body: { error: 'Sightengine response missing expected "type.ai_generated" score.', details: data },
    };
  }

  return {
    status: 200,
    body: { score, label: mapScoreToLabel(score), generators: data.type?.classes || {} },
  };
}

/**
 * Main Vercel serverless request handler.
 *
 * @param {import('@vercel/node').VercelRequest} req
 * @param {import('@vercel/node').VercelResponse} res
 */
export default async function handler(req, res) {
  // 1. Set CORS headers for preflight and standard responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown-ip';

  // Rate limit: 30 requests per minute per IP
  const isAllowed = await checkRateLimit(ip, 30, 60);
  if (!isAllowed) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  // 2. Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method Not Allowed. Only POST requests are supported.',
    });
  }

  try {
    // 3. Parse JSON body expecting { imageUrl: string }
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({
          error: 'Invalid JSON payload in request body.',
        });
      }
    }

    if (!body || typeof body !== 'object') {
      return res.status(400).json({
        error: 'Request body must be a JSON object containing "imageUrl".',
      });
    }

    const { imageUrl, licenseKey } = body;

    // 4. Validate imageUrl is a valid HTTP/HTTPS URL
    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
      return res.status(400).json({
        error: 'Missing required field: "imageUrl".',
      });
    }
    
    if (!licenseKey) {
        return res.status(401).json({ error: 'Missing license key' });
    }

    const trimmedUrl = imageUrl.trim();
    if (!isValidHttpUrl(trimmedUrl)) {
      return res.status(400).json({
        error: 'Invalid "imageUrl". Must be a valid HTTP or HTTPS URL.',
      });
    }

    // Verify Sightengine environment credentials
    const apiUser = process.env.SIGHTENGINE_API_USER;
    const apiSecret = process.env.SIGHTENGINE_API_SECRET;

    if (!apiUser || !apiSecret) {
      console.error('Missing environment variables.');
      return res.status(500).json({
        error: 'Server configuration error.',
      });
    }
    
    // Reserve 1 credit atomically before calling Sightengine, so concurrent
    // requests can't spend more credits than the license has.
    let licenses;
    let licenseDoc;
    try {
        const client = await clientPromise;
        licenses = client.db('aicheck').collection('licenses');
        licenseDoc = await licenses.findOneAndUpdate(
            { key: licenseKey, credits: { $gt: 0 } },
            { $inc: { credits: -1 } },
            { returnDocument: 'after' }
        );
    } catch (dbError) {
        console.error('Database connection error during license check:', dbError.message);
        return res.status(503).json({ error: 'License service unavailable. Please try again.' });
    }

    if (!licenseDoc) {
        return res.status(403).json({ error: 'Insufficient credits or invalid license key.' });
    }

    const result = await analyzeWithSightengine(trimmedUrl, apiUser, apiSecret).catch((err) => ({
        status: 502,
        body: { error: 'Could not reach the detection service.', message: err.message },
    }));

    if (result.status !== 200) {
        // The scan failed, so give the reserved credit back
        await licenses.updateOne({ key: licenseKey }, { $inc: { credits: 1 } }).catch((dbError) => {
            console.error('Failed to refund credit:', dbError);
        });
        return res.status(result.status).json(result.body);
    }

    return res.status(200).json({
      ...result.body,
      creditsRemaining: licenseDoc.credits
    });
  } catch (error) {
    console.error('Error during image detection:', error);
    return res.status(500).json({
      error: 'An internal error occurred while processing the image detection request.',
      message: error.message,
    });
  }
}
