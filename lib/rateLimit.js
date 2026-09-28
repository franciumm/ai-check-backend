import clientPromise from './mongodb.js';

/**
 * MongoDB-backed Fixed Window Rate Limiter
 * 
 * @param {string} identifier - Usually the IP address or License Key
 * @param {number} limit - Maximum requests allowed in the window
 * @param {number} windowSeconds - The time window in seconds
 * @returns {Promise<boolean>} - Returns true if request is allowed, false if rate limited
 */
export async function checkRateLimit(identifier, limit, windowSeconds) {
  try {
    const client = await clientPromise;
    const db = client.db('aicheck');
    const rateLimits = db.collection('ratelimits');

    // Calculate current time window bucket
    const windowMs = windowSeconds * 1000;
    const currentWindow = Math.floor(Date.now() / windowMs);
    const bucketId = `${identifier}_${currentWindow}`;

    // Increment counter for this specific time window
    const result = await rateLimits.findOneAndUpdate(
      { _id: bucketId },
      { 
        $inc: { count: 1 },
        // Set an expiry time so MongoDB can automatically clean up old records
        // Note: Requires a TTL index on expireAt, but will safely sit harmlessly if not set yet.
        $setOnInsert: { expireAt: new Date(Date.now() + windowMs * 2) } 
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Extract the count based on MongoDB driver version return structure
    const currentCount = result.value ? result.value.count : result.count;

    // If the count exceeds the limit, block the request
    if (currentCount > limit) {
      return false;
    }

    return true;
  } catch (error) {
    console.error("Rate limiter error:", error);
    // Fail open: if the database fails, we don't want to completely block legitimate users, 
    // but this depends on your strictness preference.
    return true; 
  }
}
