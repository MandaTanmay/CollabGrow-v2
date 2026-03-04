/**
 * Authorization Middleware
 * Provides role-based access control and resource ownership checks
 * CRITICAL FOR SECURITY: Prevents unauthorized access to user data and actions
 * 
 * NOTE: These middleware assume JWT authentication has already been verified
 * by the authenticateUser middleware from jwtAuth.js, which sets req.user
 */

const { query } = require('../services/db');
const { unauthorized, forbidden } = require('../utils/responseFormatter');
const logger = require('../utils/logger');

/**
 * Require authenticated user
 * Verifies that req.user exists (set by jwtAuth middleware)
 * LEGACY: Kept for backward compatibility, but authenticateUser should be used directly
 */
function requireAuth(req, res, next) {
  if (!req.user || !req.user.userId) {
    logger.security('Unauthorized access attempt - no authenticated user', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return unauthorized(res, 'Authentication required');
  }
  next();
}

/**
 * Verify user owns a project
 * Used for edit/delete/complete operations
 */
async function requireProjectOwner(req, res, next) {
  try {
    const projectId = req.params.id || req.body.project_id;
    const userId = req.user.userId;

    if (!projectId) {
      return forbidden(res, 'Project ID required');
    }

    const result = await query(
      'SELECT creator_id FROM projects WHERE id = $1',
      [projectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    if (result.rows[0].creator_id !== userId) {
      logger.security('Unauthorized project access attempt', {
        projectId,
        userId,
        ownerId: result.rows[0].creator_id,
      });
      return forbidden(res, 'Only the project owner can perform this action');
    }

    // Attach project data to request for use in route handler
    req.project = result.rows[0];
    next();
  } catch (error) {
    logger.error('Error in requireProjectOwner middleware', error);
    return res.status(500).json({
      success: false,
      error: 'Authorization check failed',
    });
  }
}

/**
 * Verify user is project owner OR collaborator
 * Used for accessing project workspace/resources
 */
async function requireProjectAccess(req, res, next) {
  try {
    const projectId = req.params.id || req.body.project_id;
    const userId = req.user.userId;

    if (!projectId) {
      return forbidden(res, 'Project ID required');
    }

    // Check if user is owner
    const projectResult = await query(
      'SELECT creator_id FROM projects WHERE id = $1',
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    const isOwner = projectResult.rows[0].creator_id === userId;

    if (isOwner) {
      req.userRole = 'owner';
      req.project = projectResult.rows[0];
      return next();
    }

    // Check if user is collaborator
    const collabResult = await query(
      'SELECT status, role FROM project_collaborators WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (collabResult.rows.length > 0 && collabResult.rows[0].status === 'Active') {
      req.userRole = collabResult.rows[0].role || 'collaborator';
      return next();
    }

    logger.security('Unauthorized project access attempt', {
      projectId,
      userId,
      reason: 'Not owner or collaborator',
    });

    return forbidden(res, 'You do not have access to this project');
  } catch (error) {
    logger.error('Error in requireProjectAccess middleware', error);
    return res.status(500).json({
      success: false,
      error: 'Authorization check failed',
    });
  }
}

/**
 * Verify user owns a resource (post, comment, etc.)
 * Generic ownership check
 */
function createOwnershipCheck(table, idField = 'id', ownerField = 'user_id') {
  return async (req, res, next) => {
    try {
      const resourceId = req.params.id || req.params[idField];
      const userId = req.user.userId;

      if (!resourceId) {
        return forbidden(res, 'Resource ID required');
      }

      const result = await query(
        `SELECT ${ownerField} FROM ${table} WHERE ${idField} = $1`,
        [resourceId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found',
        });
      }

      if (result.rows[0][ownerField] !== userId) {
        logger.security('Unauthorized resource access attempt', {
          table,
          resourceId,
          userId,
          ownerId: result.rows[0][ownerField],
        });
        return forbidden(res, 'You do not have permission to perform this action');
      }

      next();
    } catch (error) {
      logger.error('Error in ownership check middleware', error);
      return res.status(500).json({
        success: false,
        error: 'Authorization check failed',
      });
    }
  };
}

/**
 * Attach user data to request (optional middleware)
 * Adds req.user with full user data if JWT authentication exists
 * NOTE: This is now redundant since jwtAuth already sets req.user
 * Kept for backward compatibility but should be phased out
 */
async function attachUserData(req, res, next) {
  if (req.user && req.user.userId) {
    try {
      const result = await query(
        'SELECT id, email, firebase_uid, full_name, username, profile_image_url FROM users WHERE id = $1',
        [req.user.userId]
      );
      if (result.rows.length > 0) {
        // Merge database user data with JWT user data
        req.user = { ...req.user, ...result.rows[0] };
      }
    } catch (error) {
      logger.error('Error attaching user data', error);
      // Don't fail the request, just continue without enhanced user data
    }
  }
  next();
}

module.exports = {
  requireAuth,
  requireProjectOwner,
  requireProjectAccess,
  createOwnershipCheck,
  attachUserData,
};
