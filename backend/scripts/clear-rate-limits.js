/**
 * Clear Rate Limits Script
 * 
 * Use this script during development/testing to clear rate limits
 * when you get blocked by too many authentication attempts.
 * 
 * Usage:
 *   node scripts/clear-rate-limits.js
 * 
 * WARNING: This is for development only. Do not use in production.
 */

const { clearAllRateLimits, clearRateLimitForIP } = require('../middleware/rateLimiting');
const logger = require('../utils/logger');

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0];
const ip = args[1];

if (command === 'ip' && ip) {
  // Clear rate limit for specific IP
  const cleared = clearRateLimitForIP(ip);
  if (cleared) {
    console.log(`✅ Rate limit cleared for IP: ${ip}`);
  } else {
    console.log(`ℹ️  No rate limit found for IP: ${ip}`);
  }
} else if (command === 'all' || !command) {
  // Clear all rate limits
  const count = clearAllRateLimits();
  console.log(`✅ Cleared rate limits for ${count} IP address(es)`);
  console.log('⚠️  All users can now make requests again.');
} else {
  // Show usage
  console.log('Usage:');
  console.log('  node scripts/clear-rate-limits.js          # Clear all rate limits');
  console.log('  node scripts/clear-rate-limits.js all      # Clear all rate limits');
  console.log('  node scripts/clear-rate-limits.js ip <ip>  # Clear rate limit for specific IP');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/clear-rate-limits.js');
  console.log('  node scripts/clear-rate-limits.js ip 127.0.0.1');
  console.log('  node scripts/clear-rate-limits.js ip ::1');
}

process.exit(0);
