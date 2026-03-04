const Joi = require('joi');

const incrementProjectViewSchema = Joi.object({
  // No body required, just param id
});

module.exports = {
  incrementProjectViewSchema
};
