// 🔒 DIRECTORYBOLT SECURITY MIDDLEWARE
// Security middleware for API endpoints

/**
 * CORS Configuration for DirectoryBolt
 */
function configureCors(req, res, next) {
  // Get allowed origins from environment variable
  const allowedOrigins = process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : [
        'http://localhost:3000',
        'https://directorybolt.com',
        'https://www.directorybolt.com'
      ];

  const origin = req.headers.origin;

  // Allow requests from allowed origins
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  // Set other CORS headers
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, stripe-signature');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (next) next();
}

/**
 * Security Headers Middleware
 */
function setSecurityHeaders(req, res, next) {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Strict transport security (HTTPS only in production)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://js.stripe.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://api.stripe.com; " +
    "frame-src https://js.stripe.com https://hooks.stripe.com; " +
    "object-src 'none'; " +
    "base-uri 'self'"
  );
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (next) next();
}

/**
 * Rate Limiting Configuration
 */
const rateLimitConfig = {
  // General API endpoints
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: {
      error: 'Too many requests from this IP',
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429
    }
  },
  
  // Checkout endpoints (more restrictive)
  checkout: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 checkout attempts per minute
    message: {
      error: 'Too many checkout attempts. Please try again in a minute.',
      code: 'CHECKOUT_RATE_LIMIT',
      statusCode: 429
    }
  },
  
  // Webhook endpoints (very permissive for Stripe)
  webhook: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // High limit for webhooks
    message: {
      error: 'Webhook rate limit exceeded',
      code: 'WEBHOOK_RATE_LIMIT',
      statusCode: 429
    }
  }
};

/**
 * Input Validation Middleware
 */
function validateInput(req, res, next) {
  // Content-Type validation for POST requests
  if (req.method === 'POST' && req.url !== '/api/webhook') {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        error: {
          message: 'Content-Type must be application/json',
          code: 'INVALID_CONTENT_TYPE',
          statusCode: 400
        }
      });
    }
  }

  // Request size validation (prevent large payload attacks)
  const maxSize = req.url === '/api/webhook' ? 1024 * 1024 : 1024 * 10; // 1MB for webhooks, 10KB for others
  const contentLength = parseInt(req.headers['content-length'] || '0');
  
  if (contentLength > maxSize) {
    return res.status(413).json({
      error: {
        message: 'Request payload too large',
        code: 'PAYLOAD_TOO_LARGE',
        statusCode: 413
      }
    });
  }

  if (next) next();
}

/**
 * Error Sanitization
 */
function sanitizeError(error) {
  // In production, don't expose internal error details
  if (process.env.NODE_ENV === 'production') {
    const sanitizedError = {
      message: 'An error occurred',
      code: 'INTERNAL_ERROR',
      statusCode: 500
    };

    // Allow certain safe error types to pass through
    const safeErrorCodes = [
      'VALIDATION_ERROR',
      'STRIPE_ERROR',
      'RATE_LIMIT_EXCEEDED',
      'PAYMENT_ERROR',
      'CONFIG_ERROR'
    ];

    if (error.code && safeErrorCodes.includes(error.code)) {
      return {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode || 500
      };
    }

    return sanitizedError;
  }

  // In development, return full error details
  return {
    message: error.message,
    code: error.code || 'UNKNOWN_ERROR',
    statusCode: error.statusCode || 500,
    stack: error.stack
  };
}

/**
 * IP Address Extraction
 */
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  return req.connection.remoteAddress || 
         req.socket.remoteAddress || 
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         'unknown';
}

/**
 * Request Logging Middleware
 */
function logRequest(req, res, next) {
  const startTime = Date.now();
  const clientIP = getClientIP(req);
  
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`, {
    ip: clientIP,
    user_agent: req.headers['user-agent']?.substring(0, 100),
    content_type: req.headers['content-type'],
    content_length: req.headers['content-length']
  });

  // Log response when request completes
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    return originalSend.call(this, body);
  };

  if (next) next();
}

/**
 * Environment-based Security Configuration
 */
function getSecurityConfig() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    // Enable CORS in development, restrict in production
    cors: {
      enabled: true,
      origins: isDevelopment 
        ? ['http://localhost:3000', 'http://127.0.0.1:3000']
        : ['https://directorybolt.com', 'https://www.directorybolt.com']
    },
    
    // Logging configuration
    logging: {
      requests: true,
      errors: true,
      debug: isDevelopment
    },
    
    // Rate limiting
    rateLimiting: {
      enabled: isProduction,
      strict: isProduction
    },
    
    // Security headers
    securityHeaders: {
      enabled: true,
      hsts: isProduction
    }
  };
}

module.exports = {
  configureCors,
  setSecurityHeaders,
  rateLimitConfig,
  validateInput,
  sanitizeError,
  getClientIP,
  logRequest,
  getSecurityConfig
};