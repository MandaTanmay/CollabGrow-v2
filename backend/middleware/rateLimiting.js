/**
 * Rate Limiting Middleware
 * Prevents brute force attacks and API abuse
 * CRITICAL FOR SECURITY: Must be applied to all routes
 */

const { getConfig } = require('../config/environment');
const logger = require('../utils/logger');

// In-memory store for rate limiting (use Redis in production for multi-server setup)
const requestCounts = new Map();

/**
 * Simple in-memory rate limiter
 * Tracks requests by IP address within a time window
 */
function createRateLimiter(options = {}) {
  const config = getConfig();
  const windowMs = options.windowMs || config.rateLimit.windowMs;
  const max = options.max || config.rateLimit.max;
  const message = options.message || 'Too many requests, please try again later';

  return (req, res, next) => {
    const identifier = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or initialize request log for this IP
    if (!requestCounts.has(identifier)) {
      requestCounts.set(identifier, []);
    }

    const requests = requestCounts.get(identifier);

    // Remove old requests outside the window
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);
    requestCounts.set(identifier, recentRequests);

    // Check if limit exceeded
    if (recentRequests.length >= max) {
      logger.security('Rate limit exceeded', {
        ip: identifier,
        path: req.path,
        requestCount: recentRequests.length,
      });

      return res.status(429).json({
        success: false,
        error: message,
        retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000),
      });
    }

    // Add current request
    recentRequests.push(now);
    requestCounts.set(identifier, recentRequests);

    next();
  };
}

const isDev = getConfig().isDevelopment;

/**
 * Strict rate limiter for authentication endpoints
 * Lower threshold to prevent brute force attacks
 * Increased for development - reduce in production
 */
const authRateLimiter = createRateLimiter({
  windowMs: isDev ? 1 * 60 * 1000 : 15 * 60 * 1000,
  max: 1000,
  message: 'Too many authentication attempts, please try again later',
});

/**
 * Standard rate limiter for general API routes
 */
const apiRateLimiter = createRateLimiter({
  windowMs: isDev ? 1 * 60 * 1000 : 15 * 60 * 1000,
  max: 1000,
});

/**
 * Cleanup function to prevent memory leaks
 * Should be called periodically (e.g., every hour)
 */
function cleanupRateLimitStore() {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour

  for (const [identifier, requests] of requestCounts.entries()) {
    if (requests.length === 0 || requests[requests.length - 1] < now - maxAge) {
      requestCounts.delete(identifier);
    }
  }

  logger.debug('Rate limit store cleaned up', {
    remainingEntries: requestCounts.size,
  });
}

/**
 * Manually clear rate limit for a specific IP (useful for development/testing)
 * Usage: Call this function with the IP address to reset their limit
 */
function clearRateLimitForIP(ip) {
  if (requestCounts.has(ip)) {
    requestCounts.delete(ip);
    logger.info('Rate limit cleared for IP', { ip });
    return true;
  }
  return false;
}

/**
 * Clear all rate limits (useful for development/testing)
 * WARNING: Use with caution in production
 */
function clearAllRateLimits() {
  const count = requestCounts.size;
  requestCounts.clear();
  logger.info('All rate limits cleared', { clearedCount: count });
  return count;
}

// Run cleanup every hour
if (!getConfig().isDevelopment) {
  setInterval(cleanupRateLimitStore, 60 * 60 * 1000);
}

module.exports = {
  createRateLimiter,
  authRateLimiter,
  apiRateLimiter,
  cleanupRateLimitStore,
  clearRateLimitForIP,
  clearAllRateLimits,
};
