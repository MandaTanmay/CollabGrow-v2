/**
 * JWT Token Utilities
 * Handles generation and verification of access and refresh tokens
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('./logger');

// Token expiration times
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 days

// Get secrets from environment variables
const getAccessTokenSecret = () => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET is not defined in environment variables');
  }
  return secret;
};

const getRefreshTokenSecret = () => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
   throw new Error('JWT_REFRESH_SECRET is not defined in environment variables');
  }
  return secret;
};

/**
 * Generate access token
 * @param {Object} payload - User data to encode (userId, email)
 * @returns {String} JWT access token
 */
function generateAccessToken(payload) {
  try {
    const token = jwt.sign(
      {
        userId: payload.userId,
        email: payload.email,
        type: 'access',
      },
      getAccessTokenSecret(),
      {
        expiresIn: ACCESS_TOKEN_EXPIRY,
        issuer: 'CollabGrow',
        audience: 'CollabGrow-Users',
      }
    );
    return token;
  } catch (error) {
    logger.error('Error generating access token', { error: error.message });
    throw new Error('Failed to generate access token');
  }
}

/**
 * Generate refresh token
 * @param {Object} payload - User data to encode (userId)
 * @returns {String} JWT refresh token
 */
function generateRefreshToken(payload) {
  try {
    // Generate a random token identifier
    const tokenId = crypto.randomBytes(32).toString('hex');
    
    const token = jwt.sign(
      {
        userId: payload.userId,
        tokenId,
        type: 'refresh',
      },
      getRefreshTokenSecret(),
      {
        expiresIn: REFRESH_TOKEN_EXPIRY,
        issuer: 'CollabGrow',
        audience: 'CollabGrow-Users',
      }
    );
    
    return { token, tokenId };
  } catch (error) {
    logger.error('Error generating refresh token', { error: error.message });
    throw new Error('Failed to generate refresh token');
  }
}

/**
 * Verify access token
 * @param {String} token - JWT access token
 * @returns {Object} Decoded token payload
 */
function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, getAccessTokenSecret(), {
      issuer: 'CollabGrow',
      audience: 'CollabGrow-Users',
    });
    
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.debug('Access token expired');
      throw new Error('Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      logger.security('Invalid access token', { error: error.message });
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Verify refresh token
 * @param {String} token - JWT refresh token
 * @returns {Object} Decoded token payload
 */
function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, getRefreshTokenSecret(), {
      issuer: 'CollabGrow',
      audience: 'CollabGrow-Users',
    });
    
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.debug('Refresh token expired');
      throw new Error('Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      logger.security('Invalid refresh token', { error: error.message });
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Get token expiration dates
 */
function getTokenExpirations() {
  return {
    accessToken: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    refreshToken: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  };
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getTokenExpirations,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
};
