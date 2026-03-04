/**
 * JWT Authentication Middleware
 * Verifies JWT access tokens and attaches user info to request
 */

const { verifyAccessToken } = require('../utils/tokenUtils');
const logger = require('../utils/logger');

/**
 * Authenticate user via JWT access token from cookies
 * Attaches user data to req.user if valid
 */
function authenticateUser(req, res, next) {
  try {
    // Get access token from httpOnly cookie
    const accessToken = req.cookies?.accessToken;

    if (!accessToken) {
      logger.debug('No access token found in cookies', {
        path: req.path,
        method: req.method,
      });
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'NO_TOKEN',
      });
    }

    // Verify and decode the token
    const decoded = verifyAccessToken(accessToken);

   // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    logger.debug('User authenticated', { userId: decoded.userId });
    next();
  } catch (error) {
    logger.security('JWT authentication failed', {
      error: error.message,
      path: req.path,
      ip: req.ip,
    });

    if (error.message === 'Token expired') {
      return res.status(401).json({
        success: false,
        error: 'Access token expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token',
      code: 'INVALID_TOKEN',
    });
  }
}

/**
 * Optional authentication middleware
 * Attaches user if token exists, but doesn't require it
 */
function optionalAuth(req, res, next) {
  try {
    const accessToken = req.cookies?.accessToken;

    if (accessToken) {
      const decoded = verifyAccessToken(accessToken);
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
      };
    }
  } catch (error) {
    // Silent fail for optional auth
    logger.debug('Optional auth failed', { error: error.message });
  }

  next();
}

module.exports = {
  authenticateUser,
  optionalAuth,
};
