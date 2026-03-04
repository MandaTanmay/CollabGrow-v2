const Joi = require('joi');

const createCommentSchema = Joi.object({
  user_id: Joi.string().required(),
  content: Joi.string().max(1000).required()
});

module.exports = {
  createCommentSchema
};
