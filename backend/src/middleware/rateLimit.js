const WINDOW_MS_MIN = 1000;
const LIMIT_MIN = 1;

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  if (Array.isArray(xff) && xff.length > 0 && xff[0]) {
    return String(xff[0]).trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function createRateLimiter({ windowMs, limit, keyPrefix = 'default', message = 'Too many requests' }) {
  const safeWindowMs = Math.max(WINDOW_MS_MIN, Number(windowMs) || 60_000);
  const safeLimit = Math.max(LIMIT_MIN, Number(limit) || 60);
  const buckets = new Map();

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const ip = getClientIp(req);
    const key = `${keyPrefix}:${ip}`;

    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + safeWindowMs };
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(0, safeLimit - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(safeLimit));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > safeLimit) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({ error: message });
    }

    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) {
        if (now >= v.resetAt) buckets.delete(k);
      }
    }

    return next();
  };
}

module.exports = { createRateLimiter };
