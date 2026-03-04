// Joi validation middleware for Express
const Joi = require('joi');

function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    next();
  };
}

// Export both names for backward compatibility
module.exports = { 
  validate,
  validateRequest: validate // Alias for validate
};
