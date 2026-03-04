const Joi = require('joi');

const createPostSchema = Joi.object({
  user_id: Joi.string().required(),
  content: Joi.string().max(2000).required(),
  post_type: Joi.string().valid('text', 'media', 'project').required(),
  project_id: Joi.string().allow(null, ''),
  media_urls: Joi.array().items(Joi.string().uri()).default([]),
  tags: Joi.array().items(Joi.string()).default([]),
  is_pinned: Joi.boolean().default(false),
  visibility: Joi.string().valid('public', 'private', 'unlisted').default('public')
});

module.exports = {
  createPostSchema
};
