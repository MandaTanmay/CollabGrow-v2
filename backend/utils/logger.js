/**
 * Production-ready Logging Service
 * Replaces console.log/error throughout the application
 * Provides structured logging with timestamps and levels
 */

const { getConfig } = require('../config/environment');

const LogLevel = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
};

class Logger {
  constructor() {
    this.isDevelopment = !getConfig().isProduction;
  }

  _formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
  }

  error(message, error = null, meta = {}) {
    const errorMeta = error ? { 
      message: error.message, 
      stack: this.isDevelopment ? error.stack : undefined 
    } : {};
    console.error(this._formatMessage(LogLevel.ERROR, message, { ...meta, ...errorMeta }));
  }

  warn(message, meta = {}) {
    console.warn(this._formatMessage(LogLevel.WARN, message, meta));
  }

  info(message, meta = {}) {
    console.log(this._formatMessage(LogLevel.INFO, message, meta));
  }

  debug(message, meta = {}) {
    if (this.isDevelopment) {
      console.log(this._formatMessage(LogLevel.DEBUG, message, meta));
    }
  }

  // Security audit logging
  security(event, meta = {}) {
    this.warn(`SECURITY: ${event}`, meta);
  }

  // HTTP request logging
  http(method, path, statusCode, userId = null, duration = null) {
    const meta = { method, path, statusCode, userId, duration };
    if (statusCode >= 500) {
      this.error('HTTP Request Failed', null, meta);
    } else if (statusCode >= 400) {
      this.warn('HTTP Client Error', meta);
    } else if (this.isDevelopment) {
      this.info('HTTP Request', meta);
    }
  }
}

// Export singleton instance
module.exports = new Logger();
