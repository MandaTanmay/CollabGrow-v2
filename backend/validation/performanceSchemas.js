const Joi = require('joi');

/**
 * Validation schemas for contribution and performance requests
 */

const recordContributionSchema = Joi.object({
  projectId: Joi.string().uuid().required(),
  contributionType: Joi.string()
    .valid('code', 'design', 'documentation', 'testing', 'management', 'other')
    .required(),
  description: Joi.string().max(1000).allow('', null),
  hoursSpent: Joi.number().min(0).max(168).default(0),
  impactScore: Joi.number().integer().min(1).max(10).default(5)
});

const leaderboardQuerySchema = Joi.object({
  metric: Joi.string()
    .valid('reputation_points', 'completed_projects', 'tasks_completed', 'reliability', 'collaboration_success')
    .default('reputation_points'),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

module.exports = {
  recordContributionSchema,
  leaderboardQuerySchema
};
