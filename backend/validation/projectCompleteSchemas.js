const Joi = require('joi');

const completeProjectSchema = Joi.object({
  user_id: Joi.string().required()
});

module.exports = {
  completeProjectSchema
};
