/**
 * API Routes for Project Milestone & Progress Tracking
 * Handles milestone CRUD operations and progress tracking
 */

const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/jwtAuth');
const { requireProjectOwner, requireProjectAccess } = require('../middleware/authorization');
const { validateRequest } = require('../middleware/validate');
const {
  createMilestoneSchema,
  updateMilestoneSchema,
  reorderMilestonesSchema
} = require('../validation/milestoneSchemas');
const milestoneService = require('../services/milestoneService');
const { success, error, forbidden } = require('../utils/responseFormatter');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { query } = require('../services/db');

/**
 * POST /api/milestones
 * Create a new milestone (owner only)
 */
router.post('/', authenticateUser, validateRequest(createMilestoneSchema), asyncHandler(async (req, res) => {
  const { projectId, title, description, dueDate, assignedTo, orderIndex, isCritical } = req.body;
  const userId = req.user.userId;

  // Verify project ownership
  const projectResult = await query(
    'SELECT creator_id FROM projects WHERE id = $1',
    [projectId]
  );

  if (projectResult.rows.length === 0) {
    return error(res, 'Project not found', 404);
  }

  if (projectResult.rows[0].creator_id !== userId) {
    return forbidden(res, 'Only project owner can create milestones');
  }

  const milestone = await milestoneService.createMilestone({
    projectId,
    title,
    description,
    dueDate,
    createdBy: userId,
    assignedTo,
    orderIndex,
    isCritical
  });

  logger.info('Milestone created', { milestoneId: milestone.id, projectId, userId });

  return success(res, { milestone }, 'Milestone created successfully', 201);
}));

/**
 * GET /api/milestones/project/:projectId
 * Get all milestones for a project (owner and collaborators)
 */
router.get('/project/:projectId', authenticateUser, requireProjectAccess, asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const milestones = await milestoneService.getProjectMilestones(projectId);

  return success(res, { milestones, count: milestones.length }, 'Milestones retrieved successfully');
}));

/**
 * GET /api/milestones/:id
 * Get milestone details
 */
router.get('/:id', authenticateUser, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  const milestone = await milestoneService.getMilestoneById(id);

  if (!milestone) {
    return error(res, 'Milestone not found', 404);
  }

  // Check if user has access to this project
  const hasAccess = await query(
    `SELECT 1 FROM projects p
     LEFT JOIN project_collaborators pc ON p.id = pc.project_id
     WHERE p.id = $1 AND (p.creator_id = $2 OR pc.user_id = $2)
     LIMIT 1`,
    [milestone.project_id, userId]
  );

  if (hasAccess.rows.length === 0) {
    return forbidden(res, 'You do not have access to this milestone');
  }

  return success(res, { milestone }, 'Milestone retrieved successfully');
}));

/**
 * PATCH /api/milestones/:id
 * Update milestone (owner: all fields, collaborators: status only)
 */
router.patch('/:id', authenticateUser, validateRequest(updateMilestoneSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;
  const updates = req.body;

  const milestone = await milestoneService.getMilestoneById(id);

  if (!milestone) {
    return error(res, 'Milestone not found', 404);
  }

  // Check if user is owner or collaborator
  const accessResult = await query(
    `SELECT 
       p.creator_id,
       CASE WHEN p.creator_id = $2 THEN TRUE ELSE FALSE END as is_owner,
       CASE WHEN pc.user_id = $2 THEN TRUE ELSE FALSE END as is_collaborator
     FROM projects p
     LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = $2
     WHERE p.id = $1`,
    [milestone.project_id, userId]
  );

  if (accessResult.rows.length === 0) {
    return forbidden(res, 'You do not have access to this project');
  }

  const { is_owner, is_collaborator } = accessResult.rows[0];

  if (!is_owner && !is_collaborator) {
    return forbidden(res, 'You must be project owner or collaborator to update milestones');
  }

  // Collaborators can only update status
  if (!is_owner && Object.keys(updates).some(key => key !== 'status')) {
    return forbidden(res, 'Collaborators can only update milestone status');
  }

  const updatedMilestone = await milestoneService.updateMilestone(id, updates, is_owner);

  logger.info('Milestone updated', { milestoneId: id, userId, isOwner: is_owner });

  return success(res, { milestone: updatedMilestone }, 'Milestone updated successfully');
}));

/**
 * DELETE /api/milestones/:id
 * Delete milestone (owner only)
 */
router.delete('/:id', authenticateUser, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  const milestone = await milestoneService.getMilestoneById(id);

  if (!milestone) {
    return error(res, 'Milestone not found', 404);
  }

  // Verify ownership
  if (milestone.creator_id !== userId) {
    return forbidden(res, 'Only project owner can delete milestones');
  }

  await milestoneService.deleteMilestone(id);

  logger.info('Milestone deleted', { milestoneId: id, userId });

  return success(res, null, 'Milestone deleted successfully');
}));

/**
 * GET /api/milestones/progress/:projectId
 * Get project progress summary
 */
router.get('/progress/:projectId', authenticateUser, requireProjectAccess, asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const progress = await milestoneService.getProjectProgress(projectId);

  if (!progress) {
    return error(res, 'Project not found', 404);
  }

  return success(res, { progress }, 'Project progress retrieved successfully');
}));

/**
 * POST /api/milestones/reorder/:projectId
 * Reorder milestones (owner only)
 */
router.post('/reorder/:projectId', authenticateUser, validateRequest(reorderMilestonesSchema), asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { milestones } = req.body;
  const userId = req.user.userId;

  // Verify project ownership
  const projectResult = await query(
    'SELECT creator_id FROM projects WHERE id = $1',
    [projectId]
  );

  if (projectResult.rows.length === 0) {
    return error(res, 'Project not found', 404);
  }

  if (projectResult.rows[0].creator_id !== userId) {
    return forbidden(res, 'Only project owner can reorder milestones');
  }

  await milestoneService.reorderMilestones(projectId, milestones);

  logger.info('Milestones reordered', { projectId, userId, count: milestones.length });

  return success(res, null, 'Milestones reordered successfully');
}));

/**
 * GET /api/milestones/overdue
 * Get overdue milestones for current user
 */
router.get('/overdue', authenticateUser, asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const overdueMilestones = await milestoneService.getOverdueMilestones(userId);

  return success(res, { milestones: overdueMilestones, count: overdueMilestones.length }, 'Overdue milestones retrieved');
}));

/**
 * GET /api/milestones/upcoming
 * Get upcoming milestones for current user
 */
router.get('/upcoming', authenticateUser, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const days = parseInt(req.query.days) || 7;

  const upcomingMilestones = await milestoneService.getUpcomingMilestones(userId, days);

  return success(res, { milestones: upcomingMilestones, count: upcomingMilestones.length }, `Upcoming milestones (next ${days} days) retrieved`);
}));

/**
 * GET /api/milestones/statistics
 * Get milestone statistics for current user
 */
router.get('/statistics', authenticateUser, asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const statistics = await milestoneService.getMilestoneStatistics(userId);

  return success(res, { statistics }, 'Milestone statistics retrieved successfully');
}));

module.exports = router;
