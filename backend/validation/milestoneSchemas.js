const Joi = require('joi');

/**
 * Validation schemas for milestone-related requests
 */

const createMilestoneSchema = Joi.object({
  projectId: Joi.string().uuid().required(),
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(2000).allow('', null),
  dueDate: Joi.date().iso().allow(null),
  assignedTo: Joi.string().uuid().allow(null),
  orderIndex: Joi.number().integer().min(0).default(0),
  isCritical: Joi.boolean().default(false)
});

const updateMilestoneSchema = Joi.object({
  title: Joi.string().min(1).max(255),
  description: Joi.string().max(2000).allow('', null),
  dueDate: Joi.date().iso().allow(null),
  status: Joi.string().valid('pending', 'in_progress', 'completed', 'cancelled'),
  assignedTo: Joi.string().uuid().allow(null),
  orderIndex: Joi.number().integer().min(0),
  isCritical: Joi.boolean()
}).min(1); // At least one field must be provided

const reorderMilestonesSchema = Joi.object({
  milestones: Joi.array().items(
    Joi.object({
      id: Joi.string().uuid().required(),
      orderIndex: Joi.number().integer().min(0).required()
    })
  ).min(1).required()
});

module.exports = {
  createMilestoneSchema,
  updateMilestoneSchema,
  reorderMilestonesSchema
};
