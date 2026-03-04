/**
 * Compatibility Service
 * Calculates and caches compatibility scores between users and projects/users
 * Implements weighted scoring algorithm for smart collaboration matching
 */

const { query } = require('./db');
const logger = require('../utils/logger');

/**
 * Calculate compatibility score between user and project
 * Uses PostgreSQL function for complex calculation
 * @param {string} userId - User UUID
 * @param {string} projectId - Project UUID
 * @returns {Promise<Object>} Compatibility score with breakdown
 */
async function calculateProjectCompatibility(userId, projectId) {
  try {
    // Check if we have a cached score (less than 7 days old)
    const cachedResult = await query(
      `SELECT score, skill_match_score, experience_match_score, activity_match_score, 
              reputation_match_score, availability_match_score, explanation
       FROM compatibility_scores
       WHERE user_id = $1 AND target_id = $2 AND target_type = 'project'
       AND calculated_at > NOW() - INTERVAL '7 days'`,
      [userId, projectId]
    );

    if (cachedResult.rows.length > 0) {
      logger.info('Returning cached compatibility score', { userId, projectId });
      return formatCompatibilityResponse(cachedResult.rows[0]);
    }

    // Calculate new score using PostgreSQL function
    const result = await query(
      `SELECT * FROM calculate_project_compatibility($1, $2)`,
      [userId, projectId]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to calculate compatibility score');
    }

    const scoreData = result.rows[0];

    // Cache the result
    await query(
      `INSERT INTO compatibility_scores 
       (user_id, target_id, target_type, score, skill_match_score, experience_match_score, 
        activity_match_score, reputation_match_score, availability_match_score, explanation)
       VALUES ($1, $2, 'project', $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id, target_id, target_type) 
       DO UPDATE SET 
         score = EXCLUDED.score,
         skill_match_score = EXCLUDED.skill_match_score,
         experience_match_score = EXCLUDED.experience_match_score,
         activity_match_score = EXCLUDED.activity_match_score,
         reputation_match_score = EXCLUDED.reputation_match_score,
         availability_match_score = EXCLUDED.availability_match_score,
         explanation = EXCLUDED.explanation,
         calculated_at = NOW()`,
      [
        userId,
        projectId,
        scoreData.score,
        scoreData.skill_match,
        scoreData.experience_match,
        scoreData.activity_match,
        scoreData.reputation_match,
        scoreData.availability_match,
        JSON.stringify(scoreData.explanation)
      ]
    );

    logger.info('Calculated new compatibility score', {
      userId,
      projectId,
      score: scoreData.score
    });

    return formatCompatibilityResponse(scoreData);
  } catch (error) {
    logger.error('Error calculating project compatibility', error, { userId, projectId });
    throw error;
  }
}

/**
 * Calculate compatibility between two users
 * @param {string} userId1 - First user UUID
 * @param {string} userId2 - Second user UUID
 * @returns {Promise<Object>} Compatibility score with breakdown
 */
async function calculateUserCompatibility(userId1, userId2) {
  try {
    // Check cache
    const cachedResult = await query(
      `SELECT score, skill_match_score, experience_match_score, activity_match_score, 
              reputation_match_score, availability_match_score, explanation
       FROM compatibility_scores
       WHERE user_id = $1 AND target_id = $2 AND target_type = 'user'
       AND calculated_at > NOW() - INTERVAL '7 days'`,
      [userId1, userId2]
    );

    if (cachedResult.rows.length > 0) {
      return formatCompatibilityResponse(cachedResult.rows[0]);
    }

    // Get both users' data
    const usersResult = await query(
      `SELECT id, skills, experience_level, weekly_availability, activity_level, 
              reputation_points, preferred_project_types, timezone
       FROM users
       WHERE id IN ($1, $2)`,
      [userId1, userId2]
    );

    if (usersResult.rows.length !== 2) {
      throw new Error('One or both users not found');
    }

    const user1 = usersResult.rows.find(u => u.id === userId1);
    const user2 = usersResult.rows.find(u => u.id === userId2);

    // Calculate user-to-user compatibility
    const compatibility = calculateUserToUserScore(user1, user2);

    // Cache the result
    await query(
      `INSERT INTO compatibility_scores 
       (user_id, target_id, target_type, score, skill_match_score, experience_match_score, 
        activity_match_score, reputation_match_score, availability_match_score, explanation)
       VALUES ($1, $2, 'user', $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id, target_id, target_type) 
       DO UPDATE SET 
         score = EXCLUDED.score,
         skill_match_score = EXCLUDED.skill_match_score,
         experience_match_score = EXCLUDED.experience_match_score,
         activity_match_score = EXCLUDED.activity_match_score,
         reputation_match_score = EXCLUDED.reputation_match_score,
         availability_match_score = EXCLUDED.availability_match_score,
         explanation = EXCLUDED.explanation,
         calculated_at = NOW()`,
      [
        userId1,
        userId2,
        compatibility.score,
        compatibility.skillMatch,
        compatibility.experienceMatch,
        compatibility.activityMatch,
        compatibility.reputationMatch,
        compatibility.availabilityMatch,
        JSON.stringify(compatibility.explanation)
      ]
    );

    return compatibility;
  } catch (error) {
    logger.error('Error calculating user compatibility', error, { userId1, userId2 });
    throw error;
  }
}

/**
 * Get top compatible users for a project
 * @param {string} projectId - Project UUID
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Top compatible users
 */
async function getTopCompatibleUsers(projectId, limit = 10) {
  try {
    const result = await query(
      `SELECT 
         u.id,
         u.full_name,
         u.username,
         u.profile_image_url,
         u.experience_level,
         u.skills,
         u.reputation_points,
         cs.score as compatibility_score,
         cs.explanation
       FROM users u
       LEFT JOIN compatibility_scores cs 
         ON cs.user_id = u.id 
         AND cs.target_id = $1 
         AND cs.target_type = 'project'
         AND cs.calculated_at > NOW() - INTERVAL '7 days'
       WHERE u.is_active = TRUE
       ORDER BY cs.score DESC NULLS LAST
       LIMIT $2`,
      [projectId, limit]
    );

    return result.rows;
  } catch (error) {
    logger.error('Error getting top compatible users', error, { projectId });
    throw error;
  }
}

/**
 * Get recommended projects for a user based on compatibility
 * @param {string} userId - User UUID
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Recommended projects
 */
async function getRecommendedProjects(userId, limit = 10) {
  try {
    const result = await query(
      `SELECT 
         p.id,
         p.title,
         p.description,
         p.status,
         p.difficulty_level,
         p.required_skills,
         p.category,
         cs.score as compatibility_score,
         cs.explanation,
         u.full_name as creator_name
       FROM projects p
       JOIN users u ON p.creator_id = u.id
       LEFT JOIN compatibility_scores cs 
         ON cs.user_id = $1 
         AND cs.target_id = p.id 
         AND cs.target_type = 'project'
         AND cs.calculated_at > NOW() - INTERVAL '7 days'
       WHERE p.status = 'recruiting'
       AND p.is_public = TRUE
       AND p.creator_id != $1
       AND NOT EXISTS (
         SELECT 1 FROM project_collaborators pc 
         WHERE pc.project_id = p.id AND pc.user_id = $1
       )
       ORDER BY cs.score DESC NULLS LAST, p.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  } catch (error) {
    logger.error('Error getting recommended projects', error, { userId });
    throw error;
  }
}

/**
 * Batch calculate compatibility scores for multiple projects
 * Useful for updating scores in background jobs
 * @param {string} userId - User UUID
 * @param {Array<string>} projectIds - Array of project UUIDs
 * @returns {Promise<Array>} Calculated scores
 */
async function batchCalculateProjectCompatibility(userId, projectIds) {
  try {
    const scores = [];

    for (const projectId of projectIds) {
      try {
        const score = await calculateProjectCompatibility(userId, projectId);
        scores.push({ projectId, ...score });
      } catch (error) {
        logger.warn('Failed to calculate compatibility for project', { userId, projectId, error: error.message });
        // Continue with other projects
      }
    }

    return scores;
  } catch (error) {
    logger.error('Error in batch compatibility calculation', error);
    throw error;
  }
}

/**
 * Invalidate cached scores for a user (call when user profile changes)
 * @param {string} userId - User UUID
 */
async function invalidateUserScores(userId) {
  try {
    await query(
      `DELETE FROM compatibility_scores 
       WHERE user_id = $1 OR target_id = $1`,
      [userId]
    );

    logger.info('Invalidated compatibility scores for user', { userId });
  } catch (error) {
    logger.error('Error invalidating user scores', error);
    throw error;
  }
}

/**
 * Invalidate cached scores for a project (call when project changes)
 * @param {string} projectId - Project UUID
 */
async function invalidateProjectScores(projectId) {
  try {
    await query(
      `DELETE FROM compatibility_scores 
       WHERE target_id = $1 AND target_type = 'project'`,
      [projectId]
    );

    logger.info('Invalidated compatibility scores for project', { projectId });
  } catch (error) {
    logger.error('Error invalidating project scores', error);
    throw error;
  }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Calculate compatibility between two users
 * @private
 */
function calculateUserToUserScore(user1, user2) {
  const weights = {
    skill: 0.40,
    experience: 0.20,
    activity: 0.15,
    reputation: 0.15,
    availability: 0.10
  };

  // Skill match
  const user1Skills = user1.skills || [];
  const user2Skills = user2.skills || [];
  const commonSkills = user1Skills.filter(skill => user2Skills.includes(skill));
  const skillMatch = user1Skills.length > 0 
    ? (commonSkills.length / user1Skills.length) * 100 
    : 0;

  // Experience match
  const expLevels = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
  const exp1 = expLevels[user1.experience_level] || 1;
  const exp2 = expLevels[user2.experience_level] || 1;
  const expDiff = Math.abs(exp1 - exp2);
  const experienceMatch = Math.max(0, 100 - (expDiff * 30));

  // Activity match
  const activityLevels = { low: 1, moderate: 2, high: 3, very_high: 4 };
  const activity1 = activityLevels[user1.activity_level] || 2;
  const activity2 = activityLevels[user2.activity_level] || 2;
  const activityDiff = Math.abs(activity1 - activity2);
  const activityMatch = Math.max(0, 100 - (activityDiff * 25));

  // Reputation match (normalized)
  const avgReputation = (user1.reputation_points + user2.reputation_points) / 2;
  const reputationMatch = Math.min(100, (avgReputation / 100) * 100);

  // Availability match
  const availabilityDiff = Math.abs((user1.weekly_availability || 10) - (user2.weekly_availability || 10));
  const availabilityMatch = Math.max(0, 100 - (availabilityDiff / 168 * 100));

  // Calculate weighted score
  const score = (
    skillMatch * weights.skill +
    experienceMatch * weights.experience +
    activityMatch * weights.activity +
    reputationMatch * weights.reputation +
    availabilityMatch * weights.availability
  ).toFixed(2);

  return {
    score: parseFloat(score),
    skillMatch: parseFloat(skillMatch.toFixed(2)),
    experienceMatch: parseFloat(experienceMatch.toFixed(2)),
    activityMatch: parseFloat(activityMatch.toFixed(2)),
    reputationMatch: parseFloat(reputationMatch.toFixed(2)),
    availabilityMatch: parseFloat(availabilityMatch.toFixed(2)),
    explanation: {
      skill_match: {
        score: skillMatch,
        weight: 40,
        details: `${commonSkills.length} common skills out of ${user1Skills.length}`
      },
      experience_match: {
        score: experienceMatch,
        weight: 20,
        details: `${user1.experience_level} vs ${user2.experience_level}`
      },
      activity_level: {
        score: activityMatch,
        weight: 15,
        details: `${user1.activity_level} vs ${user2.activity_level}`
      },
      reputation: {
        score: reputationMatch,
        weight: 15,
        details: `Average reputation: ${Math.round(avgReputation)}`
      },
      availability: {
        score: availabilityMatch,
        weight: 10,
        details: `${user1.weekly_availability}h vs ${user2.weekly_availability}h per week`
      }
    }
  };
}

/**
 * Format compatibility response for API
 * @private
 */
function formatCompatibilityResponse(data) {
  return {
    score: parseFloat(data.score),
    breakdown: {
      skillMatch: parseFloat(data.skill_match || data.skill_match_score || 0),
      experienceMatch: parseFloat(data.experience_match || data.experience_match_score || 0),
      activityMatch: parseFloat(data.activity_match || data.activity_match_score || 0),
      reputationMatch: parseFloat(data.reputation_match || data.reputation_match_score || 0),
      availabilityMatch: parseFloat(data.availability_match || data.availability_match_score || 0)
    },
    explanation: typeof data.explanation === 'string' 
      ? JSON.parse(data.explanation) 
      : data.explanation,
    rating: getCompatibilityRating(parseFloat(data.score))
  };
}

/**
 * Get recommended collaborators for a user
 * @param {string} userId - User UUID
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Recommended collaborators
 */
async function getRecommendedCollaborators(userId, limit = 10) {
  try {
    const result = await query(
      `SELECT 
         u.id,
         u.full_name,
         u.username,
         u.email,
         u.profile_image_url,
         u.bio,
         u.university,
         u.major,
         u.experience_level,
         u.skills,
         u.interests,
         u.weekly_availability,
         u.reputation_points,
         u.profile_views,
         cs.score as compatibility_score,
         cs.skill_match_score,
         cs.experience_match_score,
         cs.explanation,
         (SELECT COUNT(*) FROM project_collaborators pc 
          WHERE pc.user_id = u.id AND pc.status = 'accepted') as projects_completed,
         (SELECT COUNT(*) FROM user_connections uc 
          WHERE (uc.user_id = $1 AND uc.connected_user_id = u.id) 
             OR (uc.connected_user_id = $1 AND uc.user_id = u.id)) as connection_count
       FROM users u
       LEFT JOIN compatibility_scores cs 
         ON cs.user_id = $1 
         AND cs.target_id = u.id 
         AND cs.target_type = 'user'
         AND cs.calculated_at > NOW() - INTERVAL '7 days'
       WHERE u.is_active = TRUE
       AND u.id != $1
       AND NOT EXISTS (
         SELECT 1 FROM user_connections uc 
         WHERE (uc.user_id = $1 AND uc.connected_user_id = u.id 
                AND uc.status = 'accepted')
            OR (uc.connected_user_id = $1 AND uc.user_id = u.id 
                AND uc.status = 'accepted')
       )
       ORDER BY cs.score DESC NULLS LAST, u.reputation_points DESC
       LIMIT $2`,
      [userId, limit]
    );

    if (result.rows.length > 0) {
      return result.rows;
    }

    // --- External data integration: GitHub trending developers (mock/fallback) ---
    // In production, replace this with a real API call or scraping logic.
    // Example: https://github.com/trending/developers
    // Here we mock a few trending developers as fallback.
    const externalCollaborators = [
      {
        id: 'gh_dev_1',
        full_name: 'Alice Johnson',
        username: 'alicejohnson',
        email: '',
        profile_image_url: 'https://avatars.githubusercontent.com/u/1?v=4',
        bio: 'Open source enthusiast. Top contributor to React.',
        university: 'N/A',
        major: 'Software Engineering',
        experience_level: 'expert',
        skills: ['React', 'JavaScript', 'TypeScript'],
        interests: ['Open Source', 'Web Development'],
        weekly_availability: 10,
        reputation_points: 2000,
        profile_views: 1000,
        compatibility_score: 90,
        skill_match_score: 80,
        experience_match_score: 90,
        explanation: { skill_match: { score: 80, weight: 40, details: 'Trending React developer' } },
        projects_completed: 25,
        connection_count: 0
      },
      {
        id: 'gh_dev_2',
        full_name: 'Bob Lee',
        username: 'boblee',
        email: '',
        profile_image_url: 'https://avatars.githubusercontent.com/u/2?v=4',
        bio: 'Maintainer of popular Node.js libraries.',
        university: 'N/A',
        major: 'Backend Engineering',
        experience_level: 'advanced',
        skills: ['Node.js', 'TypeScript', 'API Design'],
        interests: ['APIs', 'Open Source'],
        weekly_availability: 8,
        reputation_points: 1800,
        profile_views: 800,
        compatibility_score: 85,
        skill_match_score: 75,
        experience_match_score: 85,
        explanation: { skill_match: { score: 75, weight: 40, details: 'Trending Node.js developer' } },
        projects_completed: 18,
        connection_count: 0
      }
    ];
    return externalCollaborators.slice(0, limit);
  } catch (error) {
    logger.error('Error getting recommended collaborators', error, { userId });
    throw error;
  }
}

/**
 * Get recommended skills for a user based on their current skills and market trends
 * @param {string} userId - User UUID
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Recommended skills
 */
async function getRecommendedSkills(userId, limit = 5) {
  try {
    // Get user's current skills
    const userResult = await query(
      `SELECT skills, interests FROM users WHERE id = $1`,
      [userId]
    );
    if (userResult.rows.length === 0) {
      return [];
    }
    const userSkills = userResult.rows[0].skills || [];
    const userInterests = userResult.rows[0].interests || [];

    // --- Trending skills based on project creation (internal data) ---
    const trendingSkillsResult = await query(
      `SELECT 
         skill,
         COUNT(*) as project_count,
         ROUND(AVG(difficulty_weight)) as avg_difficulty
       FROM (
         SELECT 
           UNNEST(required_skills) as skill,
           CASE 
             WHEN difficulty_level = 'beginner' THEN 1
             WHEN difficulty_level = 'intermediate' THEN 2
             WHEN difficulty_level = 'advanced' THEN 3
             ELSE 2
           END as difficulty_weight
         FROM projects
         WHERE status = 'recruiting'
         AND created_at > NOW() - INTERVAL '60 days'
       ) skills_data
       WHERE skill NOT IN (SELECT UNNEST($1::text[]))
       GROUP BY skill
       ORDER BY project_count DESC
       LIMIT $2`,
      [userSkills, limit * 2]
    );
    const trendingSkills = trendingSkillsResult.rows.map(row => ({
      skill: row.skill,
      project_demand: parseInt(row.project_count),
      difficulty: parseInt(row.avg_difficulty),
      source: 'internal'
    }));

    // --- External data integration: GitHub trending ---
    const fetch = require('node-fetch');
    async function fetchGitHubTrendingSkills() {
      try {
        // GitHub trending repos (scraped, as no official API)
        const res = await fetch('https://ghapi.huchen.dev/repositories?since=weekly');
        if (!res.ok) return [];
        const repos = await res.json();
        // Count languages
        const langCount = {};
        repos.forEach(repo => {
          if (repo.language) {
            langCount[repo.language] = (langCount[repo.language] || 0) + 1;
          }
        });
        // Top trending languages as skills
        return Object.entries(langCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit * 2)
          .map(([skill, count], idx) => ({
            skill,
            project_demand: 0,
            difficulty: 2,
            source: 'external',
            external_trend_score: 80 + (limit * 2 - idx),
            github_count: count
          }));
      } catch (err) {
        return [];
      }
    }
    const externalSkills = await fetchGitHubTrendingSkills();

    // --- Merge and rank skills ---
    // Priority: trending internal skills, then external skills not already recommended
    const recommended = [];
    const seen = new Set([...userSkills]);

    // Add trending internal skills
    for (const skill of trendingSkills) {
      if (!seen.has(skill.skill) && recommended.length < limit) {
        recommended.push({
          ...skill,
          reason: 'trending',
          growth_potential: 'high'
        });
        seen.add(skill.skill);
      }
    }

    // Add external trending skills not already recommended
    for (const skill of externalSkills) {
      if (!seen.has(skill.skill) && recommended.length < limit) {
        recommended.push({
          ...skill,
          reason: 'external_trend',
          growth_potential: 'high'
        });
        seen.add(skill.skill);
      }
    }

    return recommended.slice(0, limit);
  } catch (error) {
    logger.error('Error getting recommended skills', error, { userId });
    throw error;
  }
}

/**
 * Get human-readable compatibility rating
 * @private
 */
function getCompatibilityRating(score) {
  if (score >= 90) return 'Excellent Match';
  if (score >= 75) return 'Very Good Match';
  if (score >= 60) return 'Good Match';
  if (score >= 45) return 'Moderate Match';
  if (score >= 30) return 'Fair Match';
  return 'Low Match';
}

module.exports = {
  calculateProjectCompatibility,
  calculateUserCompatibility,
  getTopCompatibleUsers,
  getRecommendedProjects,
  getRecommendedCollaborators,
  getRecommendedSkills,
  batchCalculateProjectCompatibility,
  invalidateUserScores,
  invalidateProjectScores
};
