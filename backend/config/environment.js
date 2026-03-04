/**
 * Environment Configuration Validator
 * Validates all required environment variables on startup
 * Prevents app from starting with missing/invalid configuration
 */

const requiredEnvVars = {
  production: [
    'DATABASE_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'FRONTEND_URL',
    'NODE_ENV',
  ],
  development: [
    'DATABASE_URL',
  ]
};

const optionalEnvVars = {
  PORT: 5000,
  FRONTEND_URL: 'http://localhost:3000',
  NODE_ENV: 'development',
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,
};

function validateEnvironment() {
  const env = process.env.NODE_ENV || 'development';
  const required = requiredEnvVars[env] || requiredEnvVars.development;
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error(`❌ FATAL: Missing required environment variables: ${missing.join(', ')}`);
    console.error('Please check your .env file and ensure all required variables are set.');
    process.exit(1);
  }

  // Validate production-specific requirements
  if (env === 'production') {
    if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.length < 32) {
      console.error('❌ FATAL: JWT_ACCESS_SECRET must be a strong secret (32+ characters) in production');
      process.exit(1);
    }
    
    if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) {
      console.error('❌ FATAL: JWT_REFRESH_SECRET must be a strong secret (32+ characters) in production');
      process.exit(1);
    }

    if (!process.env.FRONTEND_URL?.startsWith('https://')) {
      console.warn('⚠️  WARNING: FRONTEND_URL should use HTTPS in production');
    }
  }

  console.log(`✓ Environment validated: ${env}`);
}

function getConfig() {
  return {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT) || optionalEnvVars.PORT,
    database: {
      url: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    },
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET,
      refreshSecret: process.env.JWT_REFRESH_SECRET,
    },
    cors: {
      origin: process.env.FRONTEND_URL || optionalEnvVars.FRONTEND_URL,
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || optionalEnvVars.RATE_LIMIT_WINDOW,
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || optionalEnvVars.RATE_LIMIT_MAX_REQUESTS,
    },
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV !== 'production',
  };
}

module.exports = {
  validateEnvironment,
  getConfig,
};
