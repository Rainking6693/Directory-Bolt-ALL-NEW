// DirectoryBolt Queue Processing - Comprehensive Validation & Error Handling
// Centralized validation, sanitization, and error management for queue operations
// Includes security validation, data sanitization, and structured error responses

const Joi = require('joi');
const DOMPurify = require('isomorphic-dompurify');

// Custom validation messages
const VALIDATION_MESSAGES = {
  'string.empty': 'Field cannot be empty',
  'string.min': 'Field must be at least {#limit} characters long',
  'string.max': 'Field must not exceed {#limit} characters',
  'string.email': 'Must be a valid email address',
  'string.uri': 'Must be a valid URL',
  'string.uuid': 'Must be a valid UUID',
  'number.min': 'Value must be at least {#limit}',
  'number.max': 'Value must not exceed {#limit}',
  'array.min': 'Array must contain at least {#limit} items',
  'array.max': 'Array must not exceed {#limit} items',
  'any.required': 'Field is required',
  'any.only': 'Field must be one of {#values}'
};

// Common validation schemas
const CommonSchemas = {
  uuid: Joi.string().uuid().required(),
  email: Joi.string().email().max(255),
  url: Joi.string().uri().max(2048),
  businessName: Joi.string().min(2).max(255).pattern(/^[a-zA-Z0-9\s\-\.'&,()]+$/).required(),
  businessDescription: Joi.string().max(2000).allow(''),
  priority: Joi.number().integer().min(1).max(5).default(3),
  dateTime: Joi.date().iso(),
  status: Joi.string().valid(
    'pending', 'queued', 'processing', 'submitted', 
    'approved', 'rejected', 'failed', 'cancelled', 'needs_review'
  )
};

// Security validation rules
const SECURITY_RULES = {
  maxStringLength: 10000,
  maxArrayLength: 1000,
  maxObjectDepth: 10,
  allowedFileTypes: ['jpg', 'jpeg', 'png', 'pdf', 'gif'],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  forbiddenPatterns: [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /eval\s*\(/gi,
    /function\s*\(/gi
  ],
  sqlInjectionPatterns: [
    /(\bunion\b.*\bselect\b)|(\bselect\b.*\bunion\b)/gi,
    /\b(insert|update|delete|drop|create|alter)\b.*\b(into|from|table|database)\b/gi,
    /['";]\s*;\s*--/gi,
    /\bor\b\s+\d+\s*=\s*\d+/gi
  ]
};

class QueueValidator {
  constructor() {
    // Initialize custom Joi with validation messages
    this.joi = Joi.defaults(schema => 
      schema.options({
        errors: { messages: VALIDATION_MESSAGES }
      })
    );
  }

  // Comprehensive request validation
  async validateRequest(data, schema, options = {}) {
    try {
      // Security pre-validation
      const securityCheck = await this.performSecurityValidation(data);
      if (!securityCheck.valid) {
        return {
          valid: false,
          errors: securityCheck.errors,
          code: 'SECURITY_VIOLATION'
        };
      }

      // Data sanitization
      const sanitizedData = this.sanitizeData(data);

      // Joi validation
      const { error, value } = schema.validate(sanitizedData, {
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: options.allowUnknown || false,
        ...options
      });

      if (error) {
        return {
          valid: false,
          errors: this.formatValidationErrors(error.details),
          code: 'VALIDATION_FAILED'
        };
      }

      // Business logic validation
      const businessValidation = await this.performBusinessValidation(value, options.businessRules);
      if (!businessValidation.valid) {
        return {
          valid: false,
          errors: businessValidation.errors,
          code: 'BUSINESS_VALIDATION_FAILED'
        };
      }

      return {
        valid: true,
        data: value,
        warnings: businessValidation.warnings || []
      };

    } catch (error) {
      console.error('Validation error:', error);
      return {
        valid: false,
        errors: ['Validation system error'],
        code: 'VALIDATION_SYSTEM_ERROR'
      };
    }
  }

  // Security validation
  async performSecurityValidation(data) {
    const errors = [];
    
    try {
      // Check for malicious content
      this.checkForMaliciousContent(data, '', errors);
      
      // Validate data structure depth and size
      this.validateDataStructure(data, errors);
      
      // Check for SQL injection attempts
      this.checkForSqlInjection(data, errors);
      
      // Validate file uploads if present
      if (data.files || data.screenshots) {
        this.validateFileUploads(data.files || data.screenshots, errors);
      }

      return {
        valid: errors.length === 0,
        errors
      };

    } catch (error) {
      console.error('Security validation error:', error);
      return {
        valid: false,
        errors: ['Security validation failed']
      };
    }
  }

  // Check for malicious content recursively
  checkForMaliciousContent(obj, path, errors, depth = 0) {
    if (depth > SECURITY_RULES.maxObjectDepth) {
      errors.push(`Data structure too deep at ${path}`);
      return;
    }

    if (typeof obj === 'string') {
      // Check string length
      if (obj.length > SECURITY_RULES.maxStringLength) {
        errors.push(`String too long at ${path} (${obj.length} chars)`);
        return;
      }

      // Check for forbidden patterns
      for (const pattern of SECURITY_RULES.forbiddenPatterns) {
        if (pattern.test(obj)) {
          errors.push(`Potentially malicious content detected at ${path}`);
          return;
        }
      }
    } else if (Array.isArray(obj)) {
      if (obj.length > SECURITY_RULES.maxArrayLength) {
        errors.push(`Array too large at ${path} (${obj.length} items)`);
        return;
      }
      
      obj.forEach((item, index) => {
        this.checkForMaliciousContent(item, `${path}[${index}]`, errors, depth + 1);
      });
    } else if (obj !== null && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        this.checkForMaliciousContent(obj[key], path ? `${path}.${key}` : key, errors, depth + 1);
      });
    }
  }

  // Validate data structure
  validateDataStructure(data, errors) {
    const jsonString = JSON.stringify(data);
    if (jsonString.length > 1024 * 1024) { // 1MB limit
      errors.push('Request payload too large');
    }
  }

  // Check for SQL injection
  checkForSqlInjection(obj, errors, path = '') {
    if (typeof obj === 'string') {
      for (const pattern of SECURITY_RULES.sqlInjectionPatterns) {
        if (pattern.test(obj)) {
          errors.push(`Potential SQL injection detected at ${path}`);
          return;
        }
      }
    } else if (obj !== null && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        this.checkForSqlInjection(obj[key], errors, path ? `${path}.${key}` : key);
      });
    }
  }

  // Validate file uploads
  validateFileUploads(files, errors) {
    if (!Array.isArray(files)) return;
    
    files.forEach((file, index) => {
      if (file.size > SECURITY_RULES.maxFileSize) {
        errors.push(`File ${index} too large (max ${SECURITY_RULES.maxFileSize / 1024 / 1024}MB)`);
      }
      
      if (file.name) {
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (!SECURITY_RULES.allowedFileTypes.includes(extension)) {
          errors.push(`File ${index} has invalid type: ${extension}`);
        }
      }
    });
  }

  // Data sanitization
  sanitizeData(data) {
    if (typeof data === 'string') {
      return DOMPurify.sanitize(data.trim());
    } else if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    } else if (data !== null && typeof data === 'object') {
      const sanitized = {};
      Object.keys(data).forEach(key => {
        sanitized[key] = this.sanitizeData(data[key]);
      });
      return sanitized;
    }
    return data;
  }

  // Business logic validation
  async performBusinessValidation(data, businessRules) {
    const errors = [];
    const warnings = [];

    if (!businessRules) {
      return { valid: true, warnings };
    }

    // Custom business validations
    if (businessRules.validateSubscriptionLimits) {
      const limitCheck = await this.validateSubscriptionLimits(data);
      if (!limitCheck.valid) {
        errors.push(...limitCheck.errors);
      }
      if (limitCheck.warnings) {
        warnings.push(...limitCheck.warnings);
      }
    }

    if (businessRules.validateDirectoryAccess) {
      const accessCheck = await this.validateDirectoryAccess(data);
      if (!accessCheck.valid) {
        errors.push(...accessCheck.errors);
      }
    }

    if (businessRules.validateBusinessHours) {
      const hoursCheck = this.validateBusinessHours(data);
      if (!hoursCheck.valid) {
        warnings.push(...hoursCheck.warnings);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Validate subscription limits
  async validateSubscriptionLimits(data) {
    // Implementation would check against user's subscription
    return { valid: true, warnings: [] };
  }

  // Validate directory access
  async validateDirectoryAccess(data) {
    // Implementation would check directory permissions
    return { valid: true };
  }

  // Validate business hours
  validateBusinessHours(data) {
    const currentHour = new Date().getHours();
    const warnings = [];
    
    if (currentHour < 6 || currentHour > 22) {
      warnings.push('Processing initiated outside business hours may experience delays');
    }

    return { valid: true, warnings };
  }

  // Format validation errors
  formatValidationErrors(details) {
    return details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      type: detail.type,
      value: detail.context?.value
    }));
  }

  // Specific validation schemas for queue operations
  getAddQueueSchema() {
    return this.joi.object({
      user_id: CommonSchemas.uuid,
      business_data: this.joi.object({
        business_name: CommonSchemas.businessName,
        business_description: CommonSchemas.businessDescription,
        business_url: CommonSchemas.url.required(),
        business_email: CommonSchemas.email.required(),
        business_phone: this.joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/),
        business_address: this.joi.string().max(500),
        business_category: this.joi.string().max(100),
        business_logo_url: CommonSchemas.url,
        additional_info: this.joi.object()
      }).required(),
      directory_selection: this.joi.object({
        directory_ids: this.joi.array().items(CommonSchemas.uuid).min(1).max(50).required(),
        categories: this.joi.array().items(this.joi.string()),
        priority_level: CommonSchemas.priority,
        target_da_range: this.joi.object({
          min: this.joi.number().min(0).max(100),
          max: this.joi.number().min(0).max(100)
        }),
        exclude_directories: this.joi.array().items(CommonSchemas.uuid)
      }).required(),
      processing_options: this.joi.object({
        batch_name: this.joi.string().max(255),
        scheduling: this.joi.object({
          start_immediately: this.joi.boolean().default(true),
          scheduled_start: CommonSchemas.dateTime,
          processing_speed: this.joi.string().valid('slow', 'normal', 'fast').default('normal')
        }),
        notifications: this.joi.object({
          email_updates: this.joi.boolean().default(true),
          progress_webhooks: this.joi.array().items(CommonSchemas.url),
          completion_callback: CommonSchemas.url
        })
      }).default({}),
      subscription_context: this.joi.object({
        tier: this.joi.string().valid('basic', 'professional', 'enterprise').required(),
        credits_available: this.joi.number().integer().min(0),
        monthly_limit: this.joi.number().integer().min(0),
        features_enabled: this.joi.array().items(this.joi.string())
      }).required()
    });
  }

  getStatusQuerySchema() {
    return this.joi.object({
      batch_id: CommonSchemas.uuid,
      user_id: CommonSchemas.uuid,
      submission_id: CommonSchemas.uuid,
      include_details: this.joi.boolean().default(false),
      include_timeline: this.joi.boolean().default(false),
      include_analytics: this.joi.boolean().default(false)
    }).or('batch_id', 'submission_id').required();
  }

  getProcessSchema() {
    return this.joi.object({
      batch_id: CommonSchemas.uuid,
      submission_ids: this.joi.array().items(CommonSchemas.uuid).max(100),
      processing_options: this.joi.object({
        priority_override: this.joi.number().integer().min(1).max(5),
        force_restart: this.joi.boolean().default(false),
        concurrent_limit: this.joi.number().integer().min(1).max(50).default(5),
        automation_mode: this.joi.string().valid('browser', 'api', 'hybrid').default('browser'),
        retry_failed: this.joi.boolean().default(false)
      }).default({}),
      system_context: this.joi.object({
        triggered_by: this.joi.string().valid('admin', 'scheduler', 'api', 'webhook').required(),
        system_id: this.joi.string(),
        priority_reason: this.joi.string(),
        maintenance_window: this.joi.boolean().default(false)
      }).required()
    }).or('batch_id', 'submission_ids');
  }

  getCompleteSchema() {
    return this.joi.object({
      submission_id: CommonSchemas.uuid,
      verification_action_id: CommonSchemas.uuid,
      batch_completion: this.joi.object({
        batch_id: CommonSchemas.uuid.required(),
        submission_results: this.joi.array().items(this.joi.object({
          submission_id: CommonSchemas.uuid.required(),
          status: this.joi.string().required(),
          result_data: this.joi.object()
        })).required()
      }),
      completion_data: this.joi.object({
        status: this.joi.string().valid(
          'completed_success',
          'completed_failed', 
          'completed_partial',
          'requires_manual_review',
          'pending_approval',
          'cancelled'
        ).required(),
        result_data: this.joi.object({
          processing_time: this.joi.number().integer().min(0),
          quality_score: this.joi.number().min(0).max(100),
          verification_screenshots: this.joi.array().items(this.joi.string()),
          manual_notes: this.joi.string().max(2000)
        }).required()
      }).required(),
      va_context: this.joi.object({
        va_id: CommonSchemas.uuid.required(),
        completion_time: CommonSchemas.dateTime,
        quality_rating: this.joi.number().min(1).max(5)
      }).required()
    }).or('submission_id', 'verification_action_id', 'batch_completion');
  }

  getRetrySchema() {
    return this.joi.object({
      submission_id: CommonSchemas.uuid,
      batch_id: CommonSchemas.uuid,
      verification_action_id: CommonSchemas.uuid,
      retry_config: this.joi.object({
        retry_type: this.joi.string().valid('automatic', 'manual', 'scheduled').default('manual'),
        retry_delay: this.joi.number().integer().min(300).max(86400).default(3600),
        max_retry_attempts: this.joi.number().integer().min(1).max(10).default(3)
      }).default({}),
      system_context: this.joi.object({
        initiated_by: this.joi.string().valid('admin', 'va', 'scheduler', 'customer', 'system').required(),
        initiator_id: CommonSchemas.uuid,
        retry_context: this.joi.string().max(200)
      }).required()
    }).or('submission_id', 'batch_id', 'verification_action_id');
  }
}

// Error handling utilities
class QueueErrorHandler {
  constructor() {
    this.errorCodes = {
      VALIDATION_ERROR: 400,
      AUTHENTICATION_FAILED: 401,
      AUTHORIZATION_FAILED: 403,
      RESOURCE_NOT_FOUND: 404,
      RATE_LIMIT_EXCEEDED: 429,
      INTERNAL_ERROR: 500,
      SERVICE_UNAVAILABLE: 503
    };
  }

  // Create standardized error response
  createErrorResponse(error, req = null) {
    const timestamp = new Date().toISOString();
    const requestId = req?.headers['x-request-id'] || this.generateRequestId();

    // Determine error type and status code
    const { statusCode, errorCode, message } = this.classifyError(error);

    const response = {
      success: false,
      error: {
        code: errorCode,
        message: message,
        timestamp: timestamp,
        request_id: requestId
      }
    };

    // Add validation details if applicable
    if (error.validation_errors) {
      response.error.validation_errors = error.validation_errors;
    }

    // Add rate limit details if applicable
    if (error.rate_limit_info) {
      response.error.rate_limit = error.rate_limit_info;
    }

    // Add additional context in development
    if (process.env.NODE_ENV === 'development' && error.stack) {
      response.error.stack = error.stack;
      response.error.details = error.details;
    }

    // Log error for monitoring
    this.logError(error, requestId, req);

    return { statusCode, response };
  }

  // Classify error type
  classifyError(error) {
    if (error.code) {
      return {
        statusCode: this.errorCodes[error.code] || 500,
        errorCode: error.code,
        message: error.message || 'An error occurred'
      };
    }

    // Handle common error types
    if (error.name === 'ValidationError') {
      return {
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        message: 'Request validation failed'
      };
    }

    if (error.message?.includes('rate limit')) {
      return {
        statusCode: 429,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded'
      };
    }

    if (error.message?.includes('not found')) {
      return {
        statusCode: 404,
        errorCode: 'RESOURCE_NOT_FOUND',
        message: 'Resource not found'
      };
    }

    // Default to internal error
    return {
      statusCode: 500,
      errorCode: 'INTERNAL_ERROR',
      message: 'Internal server error'
    };
  }

  // Log error for monitoring
  logError(error, requestId, req) {
    const logData = {
      timestamp: new Date().toISOString(),
      request_id: requestId,
      error_code: error.code,
      error_message: error.message,
      stack: error.stack,
      endpoint: req?.url,
      method: req?.method,
      user_agent: req?.headers['user-agent'],
      ip_address: req?.ip
    };

    console.error('Queue API Error:', JSON.stringify(logData, null, 2));

    // In production, send to monitoring service
    // await this.sendToMonitoring(logData);
  }

  // Generate unique request ID
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Async error wrapper for handlers
  asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  // Global error handler middleware
  globalErrorHandler() {
    return (error, req, res, next) => {
      const { statusCode, response } = this.createErrorResponse(error, req);
      res.status(statusCode).json(response);
    };
  }
}

module.exports = {
  QueueValidator,
  QueueErrorHandler,
  CommonSchemas,
  SECURITY_RULES
};