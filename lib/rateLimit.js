// Module-level store — persists across requests within a warm serverless instance.
// Twilio Verify provides a second layer of rate limiting for phone OTPs.
const store = new Map();

// Prune entries older than 1 hour to avoid unbounded growth
function pruneIfNeeded() {
    if (store.size < 500) return;
    const now = Date.now();
    for (const [k, v] of store) {
        if (now > v.resetAt) store.delete(k);
    }
}

/**
 * @param {string} key        - e.g. "phone:+919876543210" or "email:user@example.com"
 * @param {number} max        - max attempts allowed in the window
 * @param {number} windowMs   - rolling window in milliseconds
 * @returns {{ allowed: boolean, retryAfterSeconds?: number }}
 */
export function checkRateLimit(key, max = 3, windowMs = 10 * 60 * 1000) {
    pruneIfNeeded();
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true };
    }

    if (entry.count >= max) {
        return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
    }

    entry.count += 1;
    return { allowed: true };
}
