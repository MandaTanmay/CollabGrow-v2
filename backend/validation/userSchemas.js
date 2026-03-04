const Joi = require('joi');

const createUserSchema = Joi.object({
  firebaseUid: Joi.string().required(),
  email: Joi.string().email().required(),
  fullName: Joi.string().required(),
  username: Joi.string().pattern(/^[a-zA-Z0-9._-]+$/).min(3).max(30),
  bio: Joi.string().allow(''),
  university: Joi.string().allow(''),
  major: Joi.string().allow(''),
  skills: Joi.array().items(Joi.string()).optional(),
});

module.exports = { createUserSchema };
