const Joi = require('joi');

const likeSchema = Joi.object({
  user_id: Joi.string().required()
});

module.exports = {
  likeSchema
};
