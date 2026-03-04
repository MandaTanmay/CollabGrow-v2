/**
 * API Routes for Contributor Performance Dashboard
 * Handles performance metrics, contributions, and analytics
 */

const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/jwtAuth');
const { validateRequest } = require('../middleware/validate');
const { recordContributionSchema, leaderboardQuerySchema } = require('../validation/performanceSchemas');
const performanceService = require('../services/performanceService');
const { success, error, forbidden } = require('../utils/responseFormatter');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { query } = require('../services/db');

/**
 * GET /api/performance/:userId
 * Get comprehensive performance metrics for a user
 */
router.get('/:userId', authenticateUser, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const requesterId = req.user.userId;

  // Check if user is viewing their own profile or another user's
  const isSelf = userId === requesterId;

  // Get user privacy settings
  const privacyResult = await query(
    'SELECT profile_visibility FROM user_privacy WHERE user_id = $1',
    [userId]
  );

  const isPublic = privacyResult.rows[0]?.profile_visibility !== 'private';

  if (!isSelf && !isPublic) {
    return forbidden(res, 'This user\'s performance data is private');
  }

  const performance = await performanceService.getUserPerformance(userId);

  logger.info('Performance data retrieved', { userId, requesterId, isSelf });

  return success(res, { performance }, 'Performance metrics retrieved successfully');
}));

/**
 * GET /api/performance/:userId/monthly
 * Get monthly activity trend
 */
router.get('/:userId/monthly', authenticateUser, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const months = parseInt(req.query.months) || 6;

  if (months < 1 || months > 24) {
    return error(res, 'Months must be between 1 and 24', 400);
  }

  const monthlyActivity = await performanceService.getMonthlyActivity(userId, months);

  return success(res, { activity: monthlyActivity }, `Monthly activity for last ${months} months retrieved`);
}));

/**
 * GET /api/performance/:userId/contributions
 * Get recent contributions
 */
router.get('/:userId/contributions', authenticateUser, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const limit = parseInt(req.query.limit) || 10;

  const contributions = await performanceService.getRecentContributions(userId, limit);

  return success(res, { contributions, count: contributions.length }, 'Recent contributions retrieved');
}));

/**
 * POST /api/performance/contributions
 * Record a new contribution
 */
router.post('/contributions', authenticateUser, validateRequest(recordContributionSchema), asyncHandler(async (req, res) => {
  const { projectId, contributionType, description, hoursSpent, impactScore } = req.body;
  const userId = req.user.userId;

  // Verify user is part of the project
  const accessResult = await query(
    `SELECT 1 FROM projects p
     LEFT JOIN project_collaborators pc ON p.id = pc.project_id
     WHERE p.id = $1 AND (p.creator_id = $2 OR pc.user_id = $2)
     LIMIT 1`,
    [projectId, userId]
  );

  if (accessResult.rows.length === 0) {
    return forbidden(res, 'You must be part of the project to record contributions');
  }

  const contribution = await performanceService.recordContribution({
    projectId,
    userId,
    contributionType,
    description,
    hoursSpent,
    impactScore
  });

  logger.info('Contribution recorded', { contributionId: contribution.id, userId, projectId });

  return success(res, { contribution }, 'Contribution recorded successfully', 201);
}));

/**
 * PATCH /api/performance/contributions/:contributionId/verify
 * Verify a contribution (project owner only)
 */
router.patch('/contributions/:contributionId/verify', authenticateUser, asyncHandler(async (req, res) => {
  const { contributionId } = req.params;
  const userId = req.user.userId;

  // Get contribution and verify ownership
  const contributionResult = await query(
    `SELECT pc.project_id, p.creator_id
     FROM project_contributions pc
     JOIN projects p ON pc.project_id = p.id
     WHERE pc.id = $1`,
    [contributionId]
  );

  if (contributionResult.rows.length === 0) {
    return error(res, 'Contribution not found', 404);
  }

  if (contributionResult.rows[0].creator_id !== userId) {
    return forbidden(res, 'Only project owner can verify contributions');
  }

  const contribution = await performanceService.verifyContribution(contributionId, userId);

  logger.info('Contribution verified', { contributionId, verifiedBy: userId });

  return success(res, { contribution }, 'Contribution verified successfully');
}));

/**
 * GET /api/performance/leaderboard
 * Get leaderboard rankings
 */
router.get('/leaderboard', authenticateUser, asyncHandler(async (req, res) => {
  const { metric = 'reputation_points', limit = 10 } = req.query;

  // Validate query params
  const validMetrics = ['reputation_points', 'completed_projects', 'tasks_completed', 'reliability', 'collaboration_success'];
  if (!validMetrics.includes(metric)) {
    return error(res, `Invalid metric. Must be one of: ${validMetrics.join(', ')}`, 400);
  }

  const limitNum = parseInt(limit);
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return error(res, 'Limit must be between 1 and 100', 400);
  }

  const leaderboard = await performanceService.getLeaderboard(metric, limitNum);

  return success(res, { leaderboard, metric, count: leaderboard.length }, 'Leaderboard retrieved successfully');
}));

/**
 * GET /api/performance/:userId/statistics
 * Get project statistics for a user
 */
router.get('/:userId/statistics', authenticateUser, asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const statistics = await performanceService.getProjectStatistics(userId);

  return success(res, { statistics }, 'Project statistics retrieved successfully');
}));

/**
 * GET /api/performance/:userId/peer-comparison
 * Get peer comparison (percentile rankings)
 */
router.get('/:userId/peer-comparison', authenticateUser, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const requesterId = req.user.userId;

  // Only allow users to view their own peer comparison for privacy
  if (userId !== requesterId) {
    return forbidden(res, 'You can only view your own peer comparison');
  }

  const peerComparison = await performanceService.getPeerComparison(userId);

  return success(res, { comparison: peerComparison }, 'Peer comparison retrieved successfully');
}));

/**
 * POST /api/performance/:userId/update-metrics
 * Update daily metrics (can be called manually or via cron)
 */
router.post('/:userId/update-metrics', authenticateUser, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const requesterId = req.user.userId;

  // Only allow users to update their own metrics
  if (userId !== requesterId) {
    return forbidden(res, 'You can only update your own metrics');
  }

  const metrics = await performanceService.updateDailyMetrics(userId);

  logger.info('Daily metrics updated', { userId });

  return success(res, { metrics }, 'Daily metrics updated successfully');
}));

module.exports = router;
