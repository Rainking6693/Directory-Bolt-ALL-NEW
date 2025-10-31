/**
 * Environment Variable Validator
 * Validates required environment variables and ensures proper security configurations
 */

import { logger } from './logger.ts'

// Required environment variables by category
const REQUIRED_ENV_VARS = {
  core: [
    'NODE_ENV',
    'BASE_URL',
    'NEXT_PUBLIC_APP_URL'
  ],
  stripe: [
    'STRIPE_SECRET_KEY',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET'
  ],
  database: [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ],
  security: [
    'JWT_SECRET',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET'
  ],
  ai: [
    'OPENAI_API_KEY'
  ]
}

// Security patterns for validation
const SECURITY_PATTERNS = {
  STRIPE_SECRET_KEY: {
    pattern: /^sk_(live|test)_[a-zA-Z0-9]{99,}$/,
    message: 'Invalid Stripe secret key format'
  },
  STRIPE_WEBHOOK_SECRET: {
    pattern: /^whsec_[a-zA-Z0-9]{32,}$/,
    message: 'Invalid Stripe webhook secret format'
  },
  OPENAI_API_KEY: {
    pattern: /^sk-proj-[a-zA-Z0-9_-]{20,}$/,
    message: 'Invalid OpenAI API key format'
  },
  JWT_SECRET: {
    minLength: 32,
    message: 'JWT secret must be at least 32 characters long'
  },
  JWT_ACCESS_SECRET: {
    minLength: 32,
    message: 'JWT access secret must be at least 32 characters long'
  },
  JWT_REFRESH_SECRET: {
    minLength: 32,
    message: 'JWT refresh secret must be at least 32 characters long'
  }
}

// Production security requirements
const PRODUCTION_SECURITY_CHECKS = {
  // Ensure no development/test keys in production
  prohibitedPatterns: {
    STRIPE_SECRET_KEY: /sk_test_/,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: /pk_test_/,
    ADMIN_PASSWORD: /dev|test|admin123|password/i,
    STAFF_PASSWORD: /dev|test|staff123|password/i
  },
  
  // Required secure configurations
  requiredSecure: [
    'ADMIN_API_KEY',
    'STAFF_API_KEY',
    'AUTOBOLT_API_KEY'
  ]
}

/**
 * Main environment validation function
 */
export function validateEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production'
  const results = {
    valid: true,
    errors: [],
    warnings: [],
    missing: [],
    security: {
      valid: true,
      issues: []
    }
  }

  try {
    // 1. Check for missing required variables
    validateRequiredVariables(results)
    
    // 2. Validate security patterns
    validateSecurityPatterns(results)
    
    // 3. Production-specific security checks
    if (isProduction) {
      validateProductionSecurity(results)
    }
    
    // 4. Check for environment segregation
    validateEnvironmentSegregation(results)
    
    // 5. Log validation results
    logValidationResults(results, isProduction)
    
    return results
    
  } catch (error) {
    logger.error('Environment validation failed', { metadata: { error: error.message } })
    results.valid = false
    results.errors.push('Environment validation process failed')
    return results
  }
}

/**
 * Validate required environment variables
 */
function validateRequiredVariables(results) {
  const categories = Object.keys(REQUIRED_ENV_VARS)
  
  categories.forEach(category => {
    const vars = REQUIRED_ENV_VARS[category]
    vars.forEach(varName => {
      if (!process.env[varName]) {
        results.missing.push({
          category,
          variable: varName,
          severity: 'error'
        })
        results.valid = false
      }
    })
  })
}

/**
 * Validate security patterns and formats
 */
function validateSecurityPatterns(results) {
  Object.keys(SECURITY_PATTERNS).forEach(varName => {
    const value = process.env[varName]
    if (!value) return // Already caught by required variables check
    
    const config = SECURITY_PATTERNS[varName]
    
    // Check pattern if defined
    if (config.pattern && !config.pattern.test(value)) {
      results.security.issues.push({
        variable: varName,
        issue: config.message,
        severity: 'error'
      })
      results.security.valid = false
      results.valid = false
    }
    
    // Check minimum length if defined
    if (config.minLength && value.length < config.minLength) {
      results.security.issues.push({
        variable: varName,
        issue: config.message,
        severity: 'error'
      })
      results.security.valid = false
      results.valid = false
    }
  })
}

/**
 * Production-specific security validation
 */
function validateProductionSecurity(results) {
  // Check for prohibited patterns in production
  Object.keys(PRODUCTION_SECURITY_CHECKS.prohibitedPatterns).forEach(varName => {
    const value = process.env[varName]
    const pattern = PRODUCTION_SECURITY_CHECKS.prohibitedPatterns[varName]
    
    if (value && pattern.test(value)) {
      results.security.issues.push({
        variable: varName,
        issue: `Contains development/test pattern in production: ${varName}`,
        severity: 'critical'
      })
      results.security.valid = false
      results.valid = false
    }
  })
  
  // Check for secure API keys in production
  PRODUCTION_SECURITY_CHECKS.requiredSecure.forEach(varName => {
    const value = process.env[varName]
    if (!value || value.length < 20) {
      results.security.issues.push({
        variable: varName,
        issue: 'Insecure or missing API key in production',
        severity: 'critical'
      })
      results.security.valid = false
      results.valid = false
    }
  })
  
  // Check Stripe live keys are being used
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (stripeKey && !stripeKey.startsWith('sk_live_')) {
    results.security.issues.push({
      variable: 'STRIPE_SECRET_KEY',
      issue: 'Test Stripe keys detected in production environment',
      severity: 'critical'
    })
    results.security.valid = false
    results.valid = false
  }
}

/**
 * Validate environment segregation
 */
function validateEnvironmentSegregation(results) {
  const nodeEnv = process.env.NODE_ENV
  
  // Check if production keys are mixed with development environment
  if (nodeEnv === 'development') {
    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (stripeKey && stripeKey.startsWith('sk_live_')) {
      results.warnings.push({
        category: 'environment',
        message: 'Live Stripe keys detected in development environment',
        recommendation: 'Use test keys for development'
      })
    }
  }
  
  // Check for proper environment setting
  if (!nodeEnv || !['development', 'production', 'test'].includes(nodeEnv)) {
    results.errors.push('NODE_ENV must be set to development, production, or test')
    results.valid = false
  }
}

/**
 * Log validation results
 */
function logValidationResults(results, isProduction) {
  const environment = isProduction ? 'PRODUCTION' : 'DEVELOPMENT'
  
  if (results.valid) {
    logger.info(`✅ Environment validation passed for ${environment}`, {
      metadata: {
        environment,
        warnings: results.warnings.length,
        timestamp: new Date().toISOString()
      }
    })
  } else {
    logger.error(`❌ Environment validation failed for ${environment}`, {
      metadata: {
        environment,
        errors: results.errors.length,
        missing: results.missing.length,
        securityIssues: results.security.issues.length,
        timestamp: new Date().toISOString()
      }
    })
  }
  
  // Log specific issues
  results.errors.forEach(error => {
    logger.error('Environment Error', { metadata: { error } })
  })
  
  results.missing.forEach(missing => {
    logger.error('Missing Environment Variable', { 
      metadata: { 
        variable: missing.variable, 
        category: missing.category 
      } 
    })
  })
  
  results.security.issues.forEach(issue => {
    logger.error('Security Issue', { 
      metadata: { 
        variable: issue.variable, 
        issue: issue.issue,
        severity: issue.severity 
      } 
    })
  })
  
  results.warnings.forEach(warning => {
    logger.warn('Environment Warning', { 
      metadata: { 
        category: warning.category,
        message: warning.message,
        recommendation: warning.recommendation 
      } 
    })
  })
}

/**
 * Secure environment variable getter with validation
 */
export function getSecureEnvVar(varName, required = true) {
  const value = process.env[varName]
  
  if (required && !value) {
    const error = `Required environment variable ${varName} is not set`
    logger.error(error)
    throw new Error(error)
  }
  
  // Additional security checks for sensitive variables
  if (varName.includes('SECRET') || varName.includes('KEY')) {
    if (value && value.length < 16) {
      logger.warn(`Environment variable ${varName} appears to be too short for security`)
    }
  }
  
  return value
}

/**
 * Initialize environment validation on module load
 */
export function initializeEnvironmentValidation() {
  const results = validateEnvironment()
  
  // In production, fail fast if environment is invalid
  if (process.env.NODE_ENV === 'production' && !results.valid) {
    logger.error('❌ CRITICAL: Production environment validation failed')
    
    // In a real production environment, you might want to:
    // process.exit(1)
    
    // For now, just log the critical error
    console.error('🚨 PRODUCTION ENVIRONMENT VALIDATION FAILED 🚨')
    console.error('Application may not function correctly with invalid configuration')
  }
  
  return results
}

/**
 * Validate specific API key format
 */
export function validateApiKey(keyName, keyValue) {
  if (!keyValue) {
    return { valid: false, error: `${keyName} is required` }
  }
  
  const pattern = SECURITY_PATTERNS[keyName]
  if (pattern && pattern.pattern && !pattern.pattern.test(keyValue)) {
    return { valid: false, error: pattern.message }
  }
  
  if (pattern && pattern.minLength && keyValue.length < pattern.minLength) {
    return { valid: false, error: pattern.message }
  }
  
  return { valid: true }
}

/**
 * Mask sensitive environment variables for logging
 */
export function maskSensitiveEnvVars(envObject) {
  const sensitivePatterns = [
    /key/i, /secret/i, /password/i, /token/i, /private/i, /credential/i
  ]
  
  const masked = {}
  
  Object.keys(envObject).forEach(key => {
    const isSensitive = sensitivePatterns.some(pattern => pattern.test(key))
    
    if (isSensitive && envObject[key]) {
      const value = envObject[key]
      if (value.length > 8) {
        masked[key] = value.substring(0, 4) + '***' + value.substring(value.length - 4)
      } else {
        masked[key] = '***'
      }
    } else {
      masked[key] = envObject[key]
    }
  })
  
  return masked
}