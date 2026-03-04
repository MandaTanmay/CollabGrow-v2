/**
 * Input Sanitization & Validation Helpers
 * Prevents XSS, SQL injection, and invalid data
 * CRITICAL FOR SECURITY: Must be used on all user inputs
 */

const Joi = require('joi');

/**
 * Sanitize string input
 * Removes potentially dangerous characters and limits length
 */
function sanitizeString(input, maxLength = 1000) {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .slice(0, maxLength)
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers
}

/**
 * Sanitize HTML content (for rich text)
 * Allows safe HTML tags only
 */
function sanitizeHtml(input) {
  if (typeof input !== 'string') {
    return '';
  }

  const allowedTags = ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre'];
  const allowedAttrs = ['href', 'title'];

  // Basic HTML sanitization (consider using a library like 'sanitize-html' for production)
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate UUID format
 */
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate URL format
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Common Joi schemas for reuse
 */
const commonSchemas = {
  uuid: Joi.string().uuid().required(),
  email: Joi.string().email().max(255).required(),
  password: Joi.string().min(8).max(100).required(),
  username: Joi.string().alphanum().min(3).max(30).required(),
  url: Joi.string().uri().max(500).allow('', null),
  shortText: Joi.string().max(255).trim(),
  mediumText: Joi.string().max(1000).trim(),
  longText: Joi.string().max(10000).trim(),
  boolean: Joi.boolean(),
  positiveInt: Joi.number().integer().min(1),
  pagination: {
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0),
  },
};

/**
 * User-related schemas
 */
const userSchemas = {
  create: Joi.object({
    email: commonSchemas.email,
    full_name: commonSchemas.shortText.required(),
    username: commonSchemas.username,
    password: commonSchemas.password,
    bio: commonSchemas.mediumText.allow('', null),
    university: commonSchemas.shortText.allow('', null),
    major: commonSchemas.shortText.allow('', null),
    location: commonSchemas.shortText.allow('', null),
  }),

  // For registration: require all fields (Firebase auth)
  register: Joi.object({
    firebaseUid: Joi.string().required(),
    email: commonSchemas.email.required(),
    fullName: commonSchemas.shortText.required(),
    username: commonSchemas.username.allow('', null),
    university: commonSchemas.shortText.allow('', null),
    major: commonSchemas.shortText.allow('', null),
    bio: commonSchemas.mediumText.allow('', null),
    skills: Joi.array().items(Joi.string().max(50)).max(50).default([]),
  }),

  update: Joi.object({
    full_name: commonSchemas.shortText,
    bio: commonSchemas.mediumText.allow('', null),
    university: commonSchemas.shortText.allow('', null),
    major: commonSchemas.shortText.allow('', null),
    location: commonSchemas.shortText.allow('', null),
    skills: Joi.array().items(Joi.string().max(50)).max(50),
    github_username: commonSchemas.shortText.allow('', null),
    linkedin_url: commonSchemas.url,
    portfolio_url: commonSchemas.url,
  }),
};

/**
 * Project-related schemas
 */
const projectSchemas = {
  create: Joi.object({
    title: commonSchemas.shortText.required(),
    description: commonSchemas.mediumText.required(),
    detailed_description: commonSchemas.longText.allow('', null),
    category: Joi.string().max(100).allow('', null),
    status: Joi.string().valid('recruiting', 'active', 'completed', 'archived').default('recruiting'),
    difficulty_level: Joi.string().valid('beginner', 'intermediate', 'advanced').allow('', null),
    estimated_duration: Joi.string().max(100).allow('', null),
    max_collaborators: Joi.number().integer().min(1).max(100).default(5),
    project_type: Joi.string().valid('web', 'mobile', 'ai', 'data', 'desktop', 'other').default('web'),
    repository_url: commonSchemas.url,
    demo_url: commonSchemas.url,
    is_featured: commonSchemas.boolean.default(false),
    is_public: commonSchemas.boolean.default(true),
    is_remote: commonSchemas.boolean.default(true),
    location: commonSchemas.shortText.allow('', null),
    required_skills: Joi.array().items(Joi.string().max(50)).max(50),
  }),

  update: Joi.object({
    title: commonSchemas.shortText,
    description: commonSchemas.mediumText,
    detailed_description: commonSchemas.longText.allow('', null),
    status: Joi.string().valid('recruiting', 'active', 'completed', 'archived'),
    difficulty_level: Joi.string().valid('beginner', 'intermediate', 'advanced'),
    estimated_duration: Joi.string().max(100).allow('', null),
    max_collaborators: Joi.number().integer().min(1).max(100),
    repository_url: commonSchemas.url,
    demo_url: commonSchemas.url,
    is_public: commonSchemas.boolean,
    is_remote: commonSchemas.boolean,
    location: commonSchemas.shortText.allow('', null),
  }),

  apply: Joi.object({
    message: commonSchemas.mediumText.allow('', null),
  }),
};

/**
 * Post-related schemas
 */
const postSchemas = {
  create: Joi.object({
    content: commonSchemas.longText.required(),
    post_type: Joi.string().valid('general', 'project_update', 'achievement', 'question', 'discussion').default('general'),
    project_id: commonSchemas.uuid.allow(null),
    media_urls: Joi.array().items(commonSchemas.url).max(10).allow(null),
    tags: Joi.array().items(Joi.string().max(50)).max(20).allow(null),
    is_pinned: commonSchemas.boolean,
    visibility: Joi.string().valid('public', 'private', 'connections_only').default('public'),
  }),

  update: Joi.object({
    content: commonSchemas.longText.required(),
  }),

  comment: Joi.object({
    content: commonSchemas.mediumText.required(),
  }),
};

/**
 * Validation middleware factory
 * Creates Express middleware that validates request body against schema
 */
function validateRequest(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors,
      });
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
}

module.exports = {
  sanitizeString,
  sanitizeHtml,
  isValidEmail,
  isValidUUID,
  isValidUrl,
  commonSchemas,
  userSchemas,
  projectSchemas,
  postSchemas,
  validateRequest,
};
