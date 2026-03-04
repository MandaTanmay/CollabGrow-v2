/**
 * Authentication Routes
 * Handles JWT-based login, logout, and token refresh
 * SECURITY: Rate-limited and input-validated
 */

const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/jwtAuth');
const { authRateLimiter } = require('../middleware/rateLimiting');
const { asyncHandler } = require('../middleware/errorHandler');
const authController = require('../controllers/authController');

/**
 * POST /auth/login
 * Authenticate user with Firebase and issue JWT tokens
 * SECURITY: Rate-limited to prevent brute force
 */
router.post('/login', authRateLimiter, authController.login);

/**
 * GET /auth/me
 * Get current authenticated user with full profile data
 * Returns 401 if no valid JWT token
 */
router.get('/me', authenticateUser, authController.getCurrentUser);

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 * SECURITY: Validates refresh token from database
 */
router.post('/refresh', authController.refreshAccessToken);

/**
 * POST /auth/logout
 * Revoke refresh token and clear cookies
 */
router.post('/logout', authenticateUser, authController.logout);

/**
 * POST /auth/logout-all
 * Revoke all refresh tokens for the user (logout from all devices)
 */
router.post('/logout-all', authenticateUser, authController.logoutAllDevices);

module.exports = router;
