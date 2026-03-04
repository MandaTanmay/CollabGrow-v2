/**
 * API Routes for Compatibility Scoring System
 * Handles compatibility calculations between users and projects/users
 */

const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/jwtAuth');
const { validateRequest } = require('../middleware/validate');
const compatibilityService = require('../services/compatibilityService');
const { success, error } = require('../utils/responseFormatter');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * GET /api/compatibility/project/:projectId
 * Calculate compatibility between current user and a project
 */
router.get('/project/:projectId', authenticateUser, asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.userId;

  const compatibility = await compatibilityService.calculateProjectCompatibility(userId, projectId);

  logger.info('Project compatibility calculated', { userId, projectId, score: compatibility.score });

  return success(res, compatibility, 'Compatibility score calculated successfully');
}));

/**
 * GET /api/compatibility/user/:userId
 * Calculate compatibility between current user and another user
 */
router.get('/user/:userId', authenticateUser, asyncHandler(async (req, res) => {
  const { userId: targetUserId } = req.params;
  const currentUserId = req.user.userId;

  if (targetUserId === currentUserId) {
    return error(res, 'Cannot calculate compatibility with yourself', 400);
  }

  const compatibility = await compatibilityService.calculateUserCompatibility(currentUserId, targetUserId);

  logger.info('User compatibility calculated', { currentUserId, targetUserId, score: compatibility.score });

  return success(res, compatibility, 'Compatibility score calculated successfully');
}));

/**
 * GET /api/compatibility/project/:projectId/top-matches
 * Get top compatible users for a project
 */
router.get('/project/:projectId/top-matches', authenticateUser, asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const limit = parseInt(req.query.limit) || 10;

  const topMatches = await compatibilityService.getTopCompatibleUsers(projectId, limit);

  return success(res, { matches: topMatches }, `Top ${topMatches.length} compatible users retrieved`);
}));

/**
 * GET /api/compatibility/recommendations/projects
 * Get recommended projects for current user
 */
router.get('/recommendations/projects', authenticateUser, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const limit = parseInt(req.query.limit) || 10;

  const recommendations = await compatibilityService.getRecommendedProjects(userId, limit);

  return success(res, { projects: recommendations }, `${recommendations.length} recommended projects retrieved`);
}));

/**
 * GET /api/compatibility/recommendations/collaborators
 * Get recommended collaborators for current user
 */
router.get('/recommendations/collaborators', authenticateUser, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const limit = parseInt(req.query.limit) || 10;

  const recommendations = await compatibilityService.getRecommendedCollaborators(userId, limit);

  return success(res, { collaborators: recommendations }, `${recommendations.length} recommended collaborators retrieved`);
}));

/**
 * GET /api/compatibility/recommendations/skills
 * Get recommended skills for current user
 */
router.get('/recommendations/skills', authenticateUser, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const limit = parseInt(req.query.limit) || 5;

  const recommendations = await compatibilityService.getRecommendedSkills(userId, limit);

  return success(res, { skills: recommendations }, `${recommendations.length} recommended skills retrieved`);
}));

/**
 * GET /api/compatibility/recommendations (kept for backward compatibility)
 * Get recommended projects for current user
 */
router.get('/recommendations', authenticateUser, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const limit = parseInt(req.query.limit) || 10;

  const recommendations = await compatibilityService.getRecommendedProjects(userId, limit);

  return success(res, { projects: recommendations }, `${recommendations.length} recommended projects retrieved`);
}));

/**
 * POST /api/compatibility/refresh/:projectId
 * Invalidate and recalculate compatibility scores for a project
 * Only project owner can trigger this
 */
router.post('/refresh/:projectId', authenticateUser, asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.userId;

  // Verify project ownership
  const { query } = require('../services/db');
  const projectResult = await query(
    'SELECT creator_id FROM projects WHERE id = $1',
    [projectId]
  );

  if (projectResult.rows.length === 0) {
    return error(res, 'Project not found', 404);
  }

  if (projectResult.rows[0].creator_id !== userId) {
    return error(res, 'Only project owner can refresh compatibility scores', 403);
  }

  await compatibilityService.invalidateProjectScores(projectId);

  logger.info('Compatibility scores refreshed for project', { projectId, userId });

  return success(res, null, 'Compatibility scores refreshed successfully');
}));

/**
 * POST /api/compatibility/batch-calculate
 * Batch calculate compatibility for multiple projects
 * Used for background processing
 */
router.post('/batch-calculate', authenticateUser, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { projectIds } = req.body;

  if (!Array.isArray(projectIds) || projectIds.length === 0) {
    return error(res, 'projectIds array is required', 400);
  }

  if (projectIds.length > 50) {
    return error(res, 'Maximum 50 projects per batch', 400);
  }

  const scores = await compatibilityService.batchCalculateProjectCompatibility(userId, projectIds);

  return success(res, { scores }, `Calculated compatibility for ${scores.length} projects`);
}));

module.exports = router;
