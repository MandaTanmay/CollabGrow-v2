const Joi = require('joi');

const projectLikeSchema = Joi.object({
  user_id: Joi.string().required()
});

module.exports = {
  projectLikeSchema
};
