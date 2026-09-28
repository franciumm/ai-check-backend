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

    const { imageUrl } = body;

    // 4. Validate imageUrl is a valid HTTP/HTTPS URL
    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
      return res.status(400).json({
        error: 'Missing required field: "imageUrl".',
      });
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
      console.error('Missing SIGHTENGINE_API_USER or SIGHTENGINE_API_SECRET environment variables.');
      return res.status(500).json({
        error: 'Server configuration error: Sightengine API credentials are not configured.',
      });
    }

    // 5. Call Sightengine API with FormData (NOT JSON)
    const formData = new FormData();
    formData.append('url', trimmedUrl);
    formData.append('models', 'genai');
    formData.append('api_user', apiUser);
    formData.append('api_secret', apiSecret);

    const sightengineResponse = await fetch('https://api.sightengine.com/1.0/check.json', {
      method: 'POST',
      body: formData,
    });

    // 6. Parse Sightengine response
    if (!sightengineResponse.ok) {
      const errorData = await sightengineResponse.json().catch(() => null);
      const errorMessage =
        errorData?.error?.message ||
        `Sightengine API responded with status ${sightengineResponse.status} (${sightengineResponse.statusText})`;

      return res.status(sightengineResponse.status >= 400 && sightengineResponse.status < 500 ? 400 : 502).json({
        error: errorMessage,
        details: errorData || undefined,
      });
    }

    const data = await sightengineResponse.json();

    // Check for application-level failure returned by Sightengine
    if (data.status === 'failure') {
      return res.status(400).json({
        error: data.error?.message || 'Sightengine analysis failed for the provided image.',
        details: data.error,
      });
    }

    // 7. Extract the ai_generated score from response.type.ai_generated
    const score = data?.type?.ai_generated;
    if (typeof score !== 'number') {
      return res.status(502).json({
        error: 'Sightengine response missing expected "type.ai_generated" score.',
        details: data,
      });
    }

    // 8. Map score to label
    const label = mapScoreToLabel(score);

    // 9. Return JSON: { score, label, generators: response.type.classes || {} }
    const generators = data.type?.classes || {};

    return res.status(200).json({
      score,
      label,
      generators,
    });
  } catch (error) {
    console.error('Error during image detection:', error);
    return res.status(500).json({
      error: 'An internal error occurred while processing the image detection request.',
      message: error.message,
    });
  }
}
