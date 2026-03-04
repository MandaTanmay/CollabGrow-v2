/**
 * Session Auth Middleware (DEPRECATED)
 * 
 * This file is deprecated and maintained only for backward compatibility.
 * All authentication has been migrated to JWT-based authentication.
 * 
 * Please use:
 * - authenticateUser from './jwtAuth' for protected routes
 * - optionalAuth from './jwtAuth' for optional authentication
 * 
 * This file simply re-exports jwtAuth.authenticateUser for any legacy code.
 */

const { authenticateUser } = require('./jwtAuth');

// Alias for backward compatibility
const requireAuth = authenticateUser;

module.exports = { requireAuth };
