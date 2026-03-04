/**
 * Global Error Handler Middleware
 * Production-ready centralized error handling
 * Masks sensitive errors in production, provides details in development
 */

const logger = require('../utils/logger');
const { getConfig } = require('../config/environment');

/**
 * Global error handler for Express
 * MUST be the last middleware in the chain
 */
function errorHandler(err, req, res, next) {
  const config = getConfig();

  // Log the error with full details
  logger.error('Unhandled Error', err, {
    method: req.method,
    path: req.path,
    body: config.isDevelopment ? req.body : undefined,
    query: config.isDevelopment ? req.query : undefined,
    userId: req.user?.userId,
    ip: req.ip,
  });

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // In production, mask internal errors
  let message = err.message || 'Internal Server Error';
  if (config.isProduction && statusCode === 500) {
    message = 'An unexpected error occurred. Please try again later.';
  }

  // Build response
  const response = {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  };

  // Add stack trace only in development
  if (config.isDevelopment && err.stack) {
    response.stack = err.stack;
  }

  // Add error code if available
  if (err.code) {
    response.code = err.code;
  }

  // Send response (prevent multiple responses)
  if (!res.headersSent) {
    return res.status(statusCode).json(response);
  }

  // If headers already sent, close the connection
  next(err);
}

/**
 * 404 Not Found Handler
 * Should be placed after all routes
 */
function notFoundHandler(req, res) {
  logger.warn('Route not found', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  return res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.path}`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors automatically
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
};
