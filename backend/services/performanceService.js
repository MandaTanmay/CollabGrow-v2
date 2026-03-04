/**
 * Performance Service
 * Tracks and analyzes user performance metrics
 * Provides data for contributor performance dashboard
 */

const { query } = require('./db');
const logger = require('../utils/logger');

/**
 * Get comprehensive performance metrics for a user
 * @param {string} userId - User UUID
 * @returns {Promise<Object>} Performance metrics
 */
async function getUserPerformance(userId) {
  try {
    // Get user performance data
    const userResult = await query(
      `SELECT 
         u.id,
         u.full_name,
         u.username,
         u.experience_level,
         u.completed_projects_count,
         u.projects_joined_count,
         u.tasks_completed_count,
         u.application_acceptance_rate,
         u.collaboration_success_rate,
         u.reliability_score,
         u.reputation_points,
         u.activity_level,
         u.weekly_availability,
         u.consistency_streak,
         u.total_contributions,
         u.created_at
       FROM users
       WHERE u.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];

    // Calculate overall performance score (0-100)
    const overallScore = calculateOverallScore(user);

    // Get monthly activity trend
    const monthlyActivity = await getMonthlyActivity(userId);

    // Get recent contributions
    const recentContributions = await getRecentContributions(userId, 10);

    // Get project completion rate
    const projectStats = await getProjectStatistics(userId);

    // Get peer comparison (percentile ranking)
    const peerComparison = await getPeerComparison(userId);

    return {
      userId: user.id,
      userName: user.full_name,
      username: user.username,
      experienceLevel: user.experience_level,
      overallScore,
      scoreBreakdown: {
        projectCompletion: calculateProjectCompletionScore(user),
        taskCompletion: calculateTaskCompletionScore(user),
        acceptanceRate: user.application_acceptance_rate,
        collaborationSuccess: user.collaboration_success_rate,
        reliability: (user.reliability_score / 10) * 100,
        activity: calculateActivityScore(user)
      },
      metrics: {
        completedProjects: user.completed_projects_count,
        projectsJoined: user.projects_joined_count,
        tasksCompleted: user.tasks_completed_count,
        acceptanceRate: user.application_acceptance_rate,
        collaborationSuccessRate: user.collaboration_success_rate,
        reliabilityScore: user.reliability_score,
        reputationPoints: user.reputation_points,
        activityLevel: user.activity_level,
        weeklyAvailability: user.weekly_availability,
        consistencyStreak: user.consistency_streak,
        totalContributions: user.total_contributions
      },
      monthlyActivity,
      recentContributions,
      projectStats,
      peerComparison,
      memberSince: user.created_at
    };
  } catch (error) {
    logger.error('Error fetching user performance', error, { userId });
    throw error;
  }
}

/**
 * Get monthly activity trend for last N months
 * @param {string} userId - User UUID
 * @param {number} months - Number of months to fetch
 * @returns {Promise<Array>} Monthly activity data
 */
async function getMonthlyActivity(userId, months = 6) {
  try {
    const result = await query(
      `SELECT * FROM get_user_monthly_activity($1, $2)`,
      [userId, months]
    );

    return result.rows.map(row => ({
      month: row.month,
      projectsJoined: parseInt(row.projects_joined) || 0,
      tasksCompleted: parseInt(row.tasks_completed) || 0,
      postsCreated: parseInt(row.posts_created) || 0,
      totalActivity: parseInt(row.total_activity) || 0
    }));
  } catch (error) {
    logger.error('Error fetching monthly activity', error, { userId });
    throw error;
  }
}

/**
 * Get recent contributions
 * @param {string} userId - User UUID
 * @param {number} limit - Number of contributions to fetch
 * @returns {Promise<Array>} Recent contributions
 */
async function getRecentContributions(userId, limit = 10) {
  try {
    const result = await query(
      `SELECT 
         pc.id,
         pc.contribution_type,
         pc.description,
         pc.hours_spent,
         pc.impact_score,
         pc.contributed_at,
         pc.verified_at,
         p.id as project_id,
         p.title as project_title,
         v.full_name as verified_by_name
       FROM project_contributions pc
       JOIN projects p ON pc.project_id = p.id
       LEFT JOIN users v ON pc.verified_by = v.id
       WHERE pc.user_id = $1
       ORDER BY pc.contributed_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  } catch (error) {
    logger.error('Error fetching recent contributions', error, { userId });
    throw error;
  }
}

/**
 * Get project statistics
 * @param {string} userId - User UUID
 * @returns {Promise<Object>} Project statistics
 */
async function getProjectStatistics(userId) {
  try {
    const result = await query(
      `SELECT 
         COUNT(DISTINCT CASE WHEN p.creator_id = $1 THEN p.id END) as projects_created,
         COUNT(DISTINCT CASE WHEN pc.user_id = $1 THEN pc.project_id END) as projects_collaborated,
         COUNT(DISTINCT CASE WHEN p.status = 'completed' AND p.creator_id = $1 THEN p.id END) as projects_completed_as_owner,
         COUNT(DISTINCT CASE WHEN p.status = 'completed' AND pc.user_id = $1 THEN pc.project_id END) as projects_completed_as_collaborator,
         COUNT(DISTINCT CASE WHEN p.status = 'active' AND (p.creator_id = $1 OR pc.user_id = $1) THEN p.id END) as active_projects,
         AVG(EXTRACT(DAY FROM p.updated_at - p.created_at)) FILTER (WHERE p.status = 'completed' AND p.creator_id = $1) as avg_completion_days,
         COUNT(DISTINCT cr.project_id) as applications_sent,
         COUNT(DISTINCT cr.project_id) FILTER (WHERE cr.status = 'accepted') as applications_accepted
       FROM users u
       LEFT JOIN projects p ON p.creator_id = u.id OR p.id IN (
         SELECT project_id FROM project_collaborators WHERE user_id = u.id
       )
       LEFT JOIN project_collaborators pc ON pc.user_id = u.id
       LEFT JOIN collaboration_requests cr ON cr.requester_id = u.id
       WHERE u.id = $1
       GROUP BY u.id`,
      [userId]
    );

    const stats = result.rows[0];

    return {
      projectsCreated: parseInt(stats.projects_created) || 0,
      projectsCollaborated: parseInt(stats.projects_collaborated) || 0,
      projectsCompletedAsOwner: parseInt(stats.projects_completed_as_owner) || 0,
      projectsCompletedAsCollaborator: parseInt(stats.projects_completed_as_collaborator) || 0,
      activeProjects: parseInt(stats.active_projects) || 0,
      avgCompletionDays: parseFloat(stats.avg_completion_days) || 0,
      applicationsSent: parseInt(stats.applications_sent) || 0,
      applicationsAccepted: parseInt(stats.applications_accepted) || 0,
      completionRate: stats.projects_created > 0 
        ? ((stats.projects_completed_as_owner / stats.projects_created) * 100).toFixed(2)
        : 0
    };
  } catch (error) {
    logger.error('Error fetching project statistics', error, { userId });
    throw error;
  }
}

/**
 * Get peer comparison (percentile ranking)
 * @param {string} userId - User UUID
 * @returns {Promise<Object>} Peer comparison data
 */
async function getPeerComparison(userId) {
  try {
    const result = await query(
      `WITH user_metrics AS (
         SELECT 
           id,
           completed_projects_count,
           tasks_completed_count,
           reputation_points,
           reliability_score
         FROM users
         WHERE is_active = TRUE
       ),
       user_data AS (
         SELECT * FROM user_metrics WHERE id = $1
       ),
       percentiles AS (
         SELECT 
           PERCENT_RANK() OVER (ORDER BY completed_projects_count) * 100 as projects_percentile,
           PERCENT_RANK() OVER (ORDER BY tasks_completed_count) * 100 as tasks_percentile,
           PERCENT_RANK() OVER (ORDER BY reputation_points) * 100 as reputation_percentile,
           PERCENT_RANK() OVER (ORDER BY reliability_score) * 100 as reliability_percentile
         FROM user_metrics
         WHERE id = $1
       )
       SELECT 
         (SELECT COUNT(*) FROM user_metrics) as total_users,
         ROUND(p.projects_percentile::numeric, 1) as projects_percentile,
         ROUND(p.tasks_percentile::numeric, 1) as tasks_percentile,
         ROUND(p.reputation_percentile::numeric, 1) as reputation_percentile,
         ROUND(p.reliability_percentile::numeric, 1) as reliability_percentile
       FROM percentiles p`,
      [userId]
    );

    const data = result.rows[0];

    return {
      totalUsers: parseInt(data.total_users) || 0,
      percentiles: {
        projects: parseFloat(data.projects_percentile) || 0,
        tasks: parseFloat(data.tasks_percentile) || 0,
        reputation: parseFloat(data.reputation_percentile) || 0,
        reliability: parseFloat(data.reliability_percentile) || 0
      },
      averagePercentile: (
        (parseFloat(data.projects_percentile) +
         parseFloat(data.tasks_percentile) +
         parseFloat(data.reputation_percentile) +
         parseFloat(data.reliability_percentile)) / 4
      ).toFixed(1)
    };
  } catch (error) {
    logger.error('Error fetching peer comparison', error, { userId });
    throw error;
  }
}

/**
 * Record a contribution
 * @param {Object} contributionData - Contribution data
 * @returns {Promise<Object>} Created contribution
 */
async function recordContribution({
  projectId,
  userId,
  contributionType,
  description,
  hoursSpent,
  impactScore = 5
}) {
  try {
    const result = await query(
      `INSERT INTO project_contributions 
       (project_id, user_id, contribution_type, description, hours_spent, impact_score)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [projectId, userId, contributionType, description, hoursSpent, impactScore]
    );

    // Update total contributions count
    await query(
      `UPDATE users 
       SET total_contributions = total_contributions + 1
       WHERE id = $1`,
      [userId]
    );

    logger.info('Contribution recorded', {
      contributionId: result.rows[0].id,
      projectId,
      userId,
      type: contributionType
    });

    return result.rows[0];
  } catch (error) {
    logger.error('Error recording contribution', error, { projectId, userId });
    throw error;
  }
}

/**
 * Verify a contribution (only project owner can verify)
 * @param {string} contributionId - Contribution UUID
 * @param {string} verifiedBy - Verifier user UUID
 * @returns {Promise<Object>} Updated contribution
 */
async function verifyContribution(contributionId, verifiedBy) {
  try {
    const result = await query(
      `UPDATE project_contributions
       SET verified_by = $1, verified_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [verifiedBy, contributionId]
    );

    if (result.rows.length === 0) {
      throw new Error('Contribution not found');
    }

    logger.info('Contribution verified', { contributionId, verifiedBy });

    return result.rows[0];
  } catch (error) {
    logger.error('Error verifying contribution', error, { contributionId });
    throw error;
  }
}

/**
 * Update daily performance metrics (call via cron job)
 * @param {string} userId - User UUID
 * @returns {Promise<Object>} Updated metrics
 */
async function updateDailyMetrics(userId) {
  try {
    // Get today's activity counts
    const activityResult = await query(
      `SELECT 
         COUNT(DISTINCT p.id) FILTER (WHERE pc.joined_at::DATE = CURRENT_DATE) as projects_joined_today,
         COUNT(DISTINCT pt.id) FILTER (WHERE pt.updated_at::DATE = CURRENT_DATE AND pt.status = 'done') as tasks_completed_today,
         COUNT(DISTINCT po.id) FILTER (WHERE po.created_at::DATE = CURRENT_DATE) as posts_created_today,
         SUM(pc2.hours_spent) FILTER (WHERE pc2.contributed_at::DATE = CURRENT_DATE) as hours_logged_today,
         (SELECT reputation_points FROM users WHERE id = $1) as current_reputation
       FROM users u
       LEFT JOIN project_collaborators pc ON u.id = pc.user_id
       LEFT JOIN projects p ON pc.project_id = p.id
       LEFT JOIN project_tasks pt ON pt.assigned_to = u.id
       LEFT JOIN posts po ON po.user_id = u.id
       LEFT JOIN project_contributions pc2 ON pc2.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );

    const activity = activityResult.rows[0];

    // Get yesterday's reputation for comparison
    const yesterdayMetric = await query(
      `SELECT reputation_gained 
       FROM user_performance_metrics 
       WHERE user_id = $1 
       AND metric_date = CURRENT_DATE - INTERVAL '1 day'
       LIMIT 1`,
      [userId]
    );

    const yesterdayReputation = yesterdayMetric.rows[0]?.reputation_gained || 0;
    const reputationGained = activity.current_reputation - yesterdayReputation;

    // Insert or update today's metrics
    const result = await query(
      `INSERT INTO user_performance_metrics 
       (user_id, metric_date, projects_active, tasks_completed, posts_created, 
        hours_logged, reputation_gained)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, metric_date)
       DO UPDATE SET
         projects_active = EXCLUDED.projects_active,
         tasks_completed = EXCLUDED.tasks_completed,
         posts_created = EXCLUDED.posts_created,
         hours_logged = EXCLUDED.hours_logged,
         reputation_gained = EXCLUDED.reputation_gained
       RETURNING *`,
      [
        userId,
        activity.projects_joined_today || 0,
        activity.tasks_completed_today || 0,
        activity.posts_created_today || 0,
        activity.hours_logged_today || 0,
        reputationGained
      ]
    );

    logger.info('Daily metrics updated', { userId });

    return result.rows[0];
  } catch (error) {
    logger.error('Error updating daily metrics', error, { userId });
    throw error;
  }
}

/**
 * Get leaderboard rankings
 * @param {string} metric - Metric to rank by
 * @param {number} limit - Number of results
 * @returns {Promise<Array>} Top performers
 */
async function getLeaderboard(metric = 'reputation_points', limit = 10) {
  try {
    const validMetrics = {
      reputation_points: 'reputation_points',
      completed_projects: 'completed_projects_count',
      tasks_completed: 'tasks_completed_count',
      reliability: 'reliability_score',
      collaboration_success: 'collaboration_success_rate'
    };

    const column = validMetrics[metric] || 'reputation_points';

    const result = await query(
      `SELECT 
         id,
         full_name,
         username,
         profile_image_url,
         ${column} as score,
         experience_level,
         RANK() OVER (ORDER BY ${column} DESC) as rank
       FROM users
       WHERE is_active = TRUE
       ORDER BY ${column} DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  } catch (error) {
    logger.error('Error fetching leaderboard', error, { metric });
    throw error;
  }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Calculate overall performance score (0-100)
 * @private
 */
function calculateOverallScore(user) {
  const weights = {
    projectCompletion: 0.25,
    taskCompletion: 0.20,
    acceptanceRate: 0.15,
    collaborationSuccess: 0.20,
    reliability: 0.10,
    activity: 0.10
  };

  const scores = {
    projectCompletion: calculateProjectCompletionScore(user),
    taskCompletion: calculateTaskCompletionScore(user),
    acceptanceRate: user.application_acceptance_rate || 0,
    collaborationSuccess: user.collaboration_success_rate || 0,
    reliability: (user.reliability_score / 10) * 100,
    activity: calculateActivityScore(user)
  };

  const overall = Object.keys(weights).reduce((total, key) => {
    return total + (scores[key] * weights[key]);
  }, 0);

  return Math.round(overall);
}

/**
 * Calculate project completion score
 * @private
 */
function calculateProjectCompletionScore(user) {
  const completedProjects = user.completed_projects_count || 0;
  const joinedProjects = user.projects_joined_count || 0;

  if (joinedProjects === 0) return 0;

  const rate = (completedProjects / joinedProjects) * 100;
  return Math.min(100, rate);
}

/**
 * Calculate task completion score
 * @private
 */
function calculateTaskCompletionScore(user) {
  const completedTasks = user.tasks_completed_count || 0;
  
  // Normalize to 0-100 scale (100 tasks = 100 score)
  return Math.min(100, completedTasks);
}

/**
 * Calculate activity score based on activity level
 * @private
 */
function calculateActivityScore(user) {
  const activityMap = {
    low: 25,
    moderate: 50,
    high: 75,
    very_high: 100
  };

  return activityMap[user.activity_level] || 50;
}

module.exports = {
  getUserPerformance,
  getMonthlyActivity,
  getRecentContributions,
  getProjectStatistics,
  getPeerComparison,
  recordContribution,
  verifyContribution,
  updateDailyMetrics,
  getLeaderboard
};
