const Joi = require('joi');

const createProjectSchema = Joi.object({
  title: Joi.string().max(255).required(),
  description: Joi.string().max(1000).required(),
  detailed_description: Joi.string().allow('', null),
  creator_id: Joi.string().required(),
  status: Joi.string().valid('open', 'in_progress', 'completed', 'archived').default('open'),
  difficulty_level: Joi.string().valid('easy', 'medium', 'hard').default('medium'),
  estimated_duration: Joi.number().integer().min(1).max(365).allow(null),
  max_collaborators: Joi.number().integer().min(1).max(100).default(5),
  project_type: Joi.string().valid('web', 'mobile', 'ai', 'data', 'other').default('web'),
  repository_url: Joi.string().uri().allow('', null),
  demo_url: Joi.string().uri().allow('', null),
  is_featured: Joi.boolean().default(false),
  is_public: Joi.boolean().default(true)
});

module.exports = {
  createProjectSchema
};
