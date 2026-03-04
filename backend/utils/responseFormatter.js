/**
 * Standardized API Response Formatter
 * Ensures consistent response structure across all endpoints
 * Masks sensitive error details in production
 */

const { getConfig } = require('../config/environment');
const logger = require('./logger');

/**
 * Success Response
 * @param {Response} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Optional success message
 * @param {number} statusCode - HTTP status code (default: 200)
 */
function success(res, data = null, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Error Response
 * @param {Response} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {Error} error - Original error object (for logging)
 * @param {object} meta - Additional metadata
 */
function error(res, message = 'Internal Server Error', statusCode = 500, error = null, meta = {}) {
  const config = getConfig();
  
  // Log the error with full details
  if (error) {
    logger.error(message, error, { statusCode, ...meta });
  } else {
    logger.warn(message, { statusCode, ...meta });
  }

  // In production, mask internal error details
  const responseMessage = config.isProduction && statusCode === 500
    ? 'An unexpected error occurred. Please try again later.'
    : message;

  const response = {
    success: false,
    error: responseMessage,
    timestamp: new Date().toISOString(),
  };

  // Include stack trace only in development
  if (config.isDevelopment && error) {
    response.details = {
      message: error.message,
      stack: error.stack,
      ...meta,
    };
  }

  return res.status(statusCode).json(response);
}

/**
 * Validation Error Response
 */
function validationError(res, errors) {
  return res.status(400).json({
    success: false,
    error: 'Validation failed',
    errors: Array.isArray(errors) ? errors : [errors],
    timestamp: new Date().toISOString(),
  });
}

/**
 * Unauthorized Response
 */
function unauthorized(res, message = 'Authentication required') {
  logger.security('Unauthorized access attempt', { message });
  return res.status(401).json({
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Forbidden Response
 */
function forbidden(res, message = 'Insufficient permissions') {
  logger.security('Forbidden access attempt', { message });
  return res.status(403).json({
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Not Found Response
 */
function notFound(res, resource = 'Resource') {
  return res.status(404).json({
    success: false,
    error: `${resource} not found`,
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  success,
  error,
  validationError,
  unauthorized,
  forbidden,
  notFound,
};
