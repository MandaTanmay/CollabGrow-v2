const express = require('express');
const router = express.Router();
const { getRecommendedProjects } = require('../services/recommendationService');
const { authenticateUser } = require('../middleware/jwtAuth');
const logger = require('../utils/logger');

router.get('/projects', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.userId;
    logger.info('[Recommend] Fetching recommendations', { userId });
    const projects = await getRecommendedProjects(userId);
    logger.info('[Recommend] Success', { userId, count: projects.length });
    res.json({ projects });
  } catch (err) {
    logger.error('[Recommend] Error', { userId: req.user.userId, error: err.message });
    console.error('[Recommend] Full error:', err);
    res.status(503).json({ error: err.message });
  }
});

module.exports = router;
