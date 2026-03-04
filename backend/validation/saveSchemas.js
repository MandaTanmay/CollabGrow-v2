const Joi = require('joi');

const saveSchema = Joi.object({
  user_id: Joi.string().required()
});

module.exports = {
  saveSchema
};
