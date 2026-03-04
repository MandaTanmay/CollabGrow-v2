const Joi = require('joi');

const applyToProjectSchema = Joi.object({
  project_id: Joi.string().required(),
  user_id: Joi.string().required(),
  message: Joi.string().max(1000).allow('', null)
});

const updateProjectApplicationSchema = Joi.object({
  // The route receives the application id via URL param and only expects an action
  action: Joi.string().valid('accept', 'reject').required(),
  // Optional fields kept for backward compatibility if sent in the body
  application_id: Joi.string().optional(),
  owner_id: Joi.string().optional()
});

module.exports = {
  applyToProjectSchema,
  updateProjectApplicationSchema
};
