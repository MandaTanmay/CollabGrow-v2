/**
 * Milestone Service
 * Manages project milestones and progress tracking
 * Enforces authorization rules and triggers progress updates
 */

const { query } = require('./db');
const logger = require('../utils/logger');

/**
 * Create a new milestone
 * Only project owner can create milestones
 * @param {Object} milestoneData - Milestone data
 * @returns {Promise<Object>} Created milestone
 */
async function createMilestone({
  projectId,
  title,
  description,
  dueDate,
  createdBy,
  assignedTo,
  orderIndex = 0,
  isCritical = false
}) {
  try {
    // Verify project ownership is done in route middleware
    const result = await query(
      `INSERT INTO project_milestones 
       (project_id, title, description, due_date, created_by, assigned_to, order_index, is_critical)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [projectId, title, description, dueDate, createdBy, assignedTo, orderIndex, isCritical]
    );

    logger.info('Milestone created', {
      milestoneId: result.rows[0].id,
      projectId,
      createdBy
    });

    return result.rows[0];
  } catch (error) {
    logger.error('Error creating milestone', error, { projectId, title });
    throw error;
  }
}

/**
 * Get all milestones for a project
 * @param {string} projectId - Project UUID
 * @returns {Promise<Array>} Milestones
 */
async function getProjectMilestones(projectId) {
  try {
    const result = await query(
      `SELECT 
         m.*,
         creator.full_name as created_by_name,
         assignee.full_name as assigned_to_name,
         CASE 
           WHEN m.status = 'completed' THEN NULL
           WHEN m.due_date < CURRENT_DATE THEN 'overdue'
           WHEN m.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
           ELSE 'on_track'
         END as urgency_status
       FROM project_milestones m
       LEFT JOIN users creator ON m.created_by = creator.id
       LEFT JOIN users assignee ON m.assigned_to = assignee.id
       WHERE m.project_id = $1
       ORDER BY m.order_index ASC, m.due_date ASC NULLS LAST, m.created_at ASC`,
      [projectId]
    );

    return result.rows;
  } catch (error) {
    logger.error('Error fetching project milestones', error, { projectId });
    throw error;
  }
}

/**
 * Get milestone by ID
 * @param {string} milestoneId - Milestone UUID
 * @returns {Promise<Object>} Milestone
 */
async function getMilestoneById(milestoneId) {
  try {
    const result = await query(
      `SELECT m.*, p.creator_id, p.title as project_title
       FROM project_milestones m
       JOIN projects p ON m.project_id = p.id
       WHERE m.id = $1`,
      [milestoneId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    logger.error('Error fetching milestone', error, { milestoneId });
    throw error;
  }
}

/**
 * Update milestone
 * Project owner can update any field
 * Collaborators can only update status
 * @param {string} milestoneId - Milestone UUID
 * @param {Object} updates - Fields to update
 * @param {boolean} isOwner - Whether requester is project owner
 * @returns {Promise<Object>} Updated milestone
 */
async function updateMilestone(milestoneId, updates, isOwner = false) {
  try {
    const allowedFields = isOwner
      ? ['title', 'description', 'due_date', 'status', 'assigned_to', 'order_index', 'is_critical']
      : ['status']; // Collaborators can only update status

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(field => {
      const snakeField = camelToSnake(field);
      if (allowedFields.includes(snakeField) && updates[field] !== undefined) {
        setClauses.push(`${snakeField} = $${paramIndex}`);
        values.push(updates[field]);
        paramIndex++;
      }
    });

    if (setClauses.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(milestoneId);

    const result = await query(
      `UPDATE project_milestones 
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Milestone not found');
    }

    logger.info('Milestone updated', {
      milestoneId,
      updates: Object.keys(updates),
      isOwner
    });

    return result.rows[0];
  } catch (error) {
    logger.error('Error updating milestone', error, { milestoneId });
    throw error;
  }
}

/**
 * Delete milestone
 * Only project owner can delete milestones
 * @param {string} milestoneId - Milestone UUID
 * @returns {Promise<boolean>} Success status
 */
async function deleteMilestone(milestoneId) {
  try {
    const result = await query(
      `DELETE FROM project_milestones WHERE id = $1 RETURNING id`,
      [milestoneId]
    );

    if (result.rows.length === 0) {
      throw new Error('Milestone not found');
    }

    logger.info('Milestone deleted', { milestoneId });

    return true;
  } catch (error) {
    logger.error('Error deleting milestone', error, { milestoneId });
    throw error;
  }
}

/**
 * Get project progress summary
 * @param {string} projectId - Project UUID
 * @returns {Promise<Object>} Progress summary
 */
async function getProjectProgress(projectId) {
  try {
    const result = await query(
      `SELECT 
         p.id,
         p.title,
         p.progress_percentage,
         p.milestones_count,
         p.completed_milestones_count,
         p.overdue_milestones_count,
         p.last_milestone_completed_at,
         CASE 
           WHEN p.overdue_milestones_count > 0 THEN 'at_risk'
           WHEN p.progress_percentage >= 75 THEN 'on_track'
           WHEN p.progress_percentage >= 50 THEN 'progressing'
           WHEN p.progress_percentage >= 25 THEN 'slow'
           ELSE 'just_started'
         END as progress_status,
         json_agg(
           json_build_object(
             'id', m.id,
             'title', m.title,
             'status', m.status,
             'due_date', m.due_date,
             'is_critical', m.is_critical
           ) ORDER BY m.order_index, m.due_date
         ) FILTER (WHERE m.id IS NOT NULL) as milestones
       FROM projects p
       LEFT JOIN project_milestones m ON p.id = m.project_id AND m.status != 'cancelled'
       WHERE p.id = $1
       GROUP BY p.id`,
      [projectId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const data = result.rows[0];

    return {
      projectId: data.id,
      projectTitle: data.title,
      progressPercentage: data.progress_percentage,
      totalMilestones: data.milestones_count,
      completedMilestones: data.completed_milestones_count,
      overdueMilestones: data.overdue_milestones_count,
      progressStatus: data.progress_status,
      lastMilestoneCompletedAt: data.last_milestone_completed_at,
      milestones: data.milestones || []
    };
  } catch (error) {
    logger.error('Error fetching project progress', error, { projectId });
    throw error;
  }
}

/**
 * Get overdue milestones across all projects for a user
 * @param {string} userId - User UUID (project owner or collaborator)
 * @returns {Promise<Array>} Overdue milestones
 */
async function getOverdueMilestones(userId) {
  try {
    const result = await query(
      `SELECT 
         m.id,
         m.title,
         m.description,
         m.due_date,
         m.status,
         p.id as project_id,
         p.title as project_title,
         EXTRACT(DAY FROM CURRENT_DATE - m.due_date) as days_overdue
       FROM project_milestones m
       JOIN projects p ON m.project_id = p.id
       LEFT JOIN project_collaborators pc ON p.id = pc.project_id
       WHERE m.status IN ('pending', 'in_progress')
       AND m.due_date < CURRENT_DATE
       AND (p.creator_id = $1 OR pc.user_id = $1)
       ORDER BY m.due_date ASC`,
      [userId]
    );

    return result.rows;
  } catch (error) {
    logger.error('Error fetching overdue milestones', error, { userId });
    throw error;
  }
}

/**
 * Get upcoming milestones (due within next 7 days)
 * @param {string} userId - User UUID
 * @returns {Promise<Array>} Upcoming milestones
 */
async function getUpcomingMilestones(userId, days = 7) {
  try {
    const result = await query(
      `SELECT 
         m.id,
         m.title,
         m.description,
         m.due_date,
         m.status,
         m.is_critical,
         p.id as project_id,
         p.title as project_title,
         EXTRACT(DAY FROM m.due_date - CURRENT_DATE) as days_until_due
       FROM project_milestones m
       JOIN projects p ON m.project_id = p.id
       LEFT JOIN project_collaborators pc ON p.id = pc.project_id
       WHERE m.status IN ('pending', 'in_progress')
       AND m.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${days} days'
       AND (p.creator_id = $1 OR pc.user_id = $1)
       ORDER BY m.due_date ASC, m.is_critical DESC`,
      [userId]
    );

    return result.rows;
  } catch (error) {
    logger.error('Error fetching upcoming milestones', error, { userId });
    throw error;
  }
}

/**
 * Reorder milestones
 * @param {string} projectId - Project UUID
 * @param {Array<{id: string, orderIndex: number}>} milestoneOrders - New order
 * @returns {Promise<boolean>} Success status
 */
async function reorderMilestones(projectId, milestoneOrders) {
  try {
    // Use transaction to ensure atomicity
    await query('BEGIN');

    for (const { id, orderIndex } of milestoneOrders) {
      await query(
        `UPDATE project_milestones 
         SET order_index = $1, updated_at = NOW()
         WHERE id = $2 AND project_id = $3`,
        [orderIndex, id, projectId]
      );
    }

    await query('COMMIT');

    logger.info('Milestones reordered', { projectId, count: milestoneOrders.length });

    return true;
  } catch (error) {
    await query('ROLLBACK');
    logger.error('Error reordering milestones', error, { projectId });
    throw error;
  }
}

/**
 * Get milestone statistics for dashboard
 * @param {string} userId - User UUID
 * @returns {Promise<Object>} Milestone statistics
 */
async function getMilestoneStatistics(userId) {
  try {
    const result = await query(
      `SELECT 
         COUNT(DISTINCT m.project_id) as projects_with_milestones,
         COUNT(*) FILTER (WHERE m.status = 'pending') as pending_milestones,
         COUNT(*) FILTER (WHERE m.status = 'in_progress') as in_progress_milestones,
         COUNT(*) FILTER (WHERE m.status = 'completed') as completed_milestones,
         COUNT(*) FILTER (WHERE m.due_date < CURRENT_DATE AND m.status NOT IN ('completed', 'cancelled')) as overdue_milestones,
         COUNT(*) FILTER (WHERE m.is_critical = TRUE AND m.status NOT IN ('completed', 'cancelled')) as critical_milestones,
         AVG(EXTRACT(DAY FROM m.completion_date - m.created_at)) FILTER (WHERE m.status = 'completed') as avg_completion_days
       FROM project_milestones m
       JOIN projects p ON m.project_id = p.id
       LEFT JOIN project_collaborators pc ON p.id = pc.project_id
       WHERE p.creator_id = $1 OR pc.user_id = $1`,
      [userId]
    );

    const stats = result.rows[0];

    return {
      projectsWithMilestones: parseInt(stats.projects_with_milestones) || 0,
      pending: parseInt(stats.pending_milestones) || 0,
      inProgress: parseInt(stats.in_progress_milestones) || 0,
      completed: parseInt(stats.completed_milestones) || 0,
      overdue: parseInt(stats.overdue_milestones) || 0,
      critical: parseInt(stats.critical_milestones) || 0,
      avgCompletionDays: parseFloat(stats.avg_completion_days) || 0
    };
  } catch (error) {
    logger.error('Error fetching milestone statistics', error, { userId });
    throw error;
  }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Convert camelCase to snake_case
 * @private
 */
function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

module.exports = {
  createMilestone,
  getProjectMilestones,
  getMilestoneById,
  updateMilestone,
  deleteMilestone,
  getProjectProgress,
  getOverdueMilestones,
  getUpcomingMilestones,
  reorderMilestones,
  getMilestoneStatistics
};
