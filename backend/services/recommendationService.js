const axios = require('axios');
const { query } = require('./db');
const logger = require('../utils/logger');

const RECOMMENDATION_URL = process.env.RECOMMENDATION_URL || 'http://localhost:8000';
const TIMEOUT = 5000;

async function getRecommendedProjects(userId) {
  try {
    // 1. Get recommended project IDs from ML microservice
    const { data } = await axios.get(
      `${RECOMMENDATION_URL}/recommend/projects/${userId}`,
      { timeout: TIMEOUT }
    );
    
    const projectIds = data.projects ? data.projects.map(p => p.id) : [];
    if (!projectIds.length) {
      logger.debug('No recommendations returned', { userId });
      return [];
    }
    
    // 2. Query PostgreSQL for full project data
    const sql = `SELECT id, title, description, category, skills, status, difficulty_level, creator_id FROM projects WHERE id = ANY($1)`;
    const result = await query(sql, [projectIds]);
    
    if (!result.rows.length) return [];
    
    // 3. Merge scores and enrich
    return result.rows.map(row => {
      const scoreObj = data.projects.find(p => p.id === row.id);
      return {
        ...row,
        match: scoreObj ? scoreObj.score : 0
      };
    });
  } catch (err) {
    logger.error('Error fetching recommendations', { userId, error: err.message });
    throw new Error('Recommendation service unavailable');
  }
}

async function getRecommendedCollaborators(projectId) {
  try {
    // 1. Get recommended collaborator IDs
    const { data } = await axios.get(
      `${RECOMMENDATION_URL}/recommend/collaborators/${projectId}`,
      { timeout: TIMEOUT }
    );
    
    const userIds = data.collaborators ? data.collaborators.map(c => c.id) : [];
    if (!userIds.length) {
      logger.debug('No collaborator recommendations', { projectId });
      return [];
    }
    
    // 2. Query PostgreSQL for user data
    const sql = `SELECT id, full_name, username, profile_image_url, skills, reputation_points FROM users WHERE id = ANY($1)`;
    const result = await query(sql, [userIds]);
    
    if (!result.rows.length) return [];
    
    // 3. Merge scores
    return result.rows.map(row => {
      const scoreObj = data.collaborators.find(c => c.id === row.id);
      return {
        ...row,
        match: scoreObj ? scoreObj.score : 0
      };
    });
  } catch (err) {
    logger.error('Error fetching collaborator recommendations', { projectId, error: err.message });
    throw new Error('Collaborator recommendation service unavailable');
  }
}

module.exports = {
  getRecommendedProjects,
  getRecommendedCollaborators
};
