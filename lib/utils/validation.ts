// 🔒 JORDAN'S VALIDATION UTILITIES - Security-first data validation
// Comprehensive input sanitization and validation for all API endpoints

import { VALIDATION_RULES } from '../database/schema'
import { ValidationError } from './errors'

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  sanitizedData?: any
}

// Email validation with domain verification
export function validateEmail(email: string): ValidationResult {
  const errors: ValidationError[] = []
  
  if (!email || typeof email !== 'string') {
    errors.push(new ValidationError('Email is required', 'email', 'REQUIRED'))
    return { isValid: false, errors }
  }
  
  const sanitized = email.toLowerCase().trim()
  
  if (!VALIDATION_RULES.email.test(sanitized)) {
    errors.push(new ValidationError('Invalid email format', 'email', 'INVALID_FORMAT'))
  }
  
  // Block common disposable email domains for security
  const disposableDomains = ['tempmail.org', '10minutemail.com', 'guerrillamail.com']
  const domain = sanitized.split('@')[1]
  if (disposableDomains.includes(domain)) {
    errors.push(new ValidationError('Disposable email addresses not allowed', 'email', 'DISPOSABLE_EMAIL'))
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: sanitized
  }
}

// URL validation with security checks
export function validateUrl(url: string): ValidationResult {
  const errors: ValidationError[] = []
  
  if (!url || typeof url !== 'string') {
    errors.push(new ValidationError('URL is required', 'url', 'REQUIRED'))
    return { isValid: false, errors }
  }
  
  let sanitized = url.trim()
  
  // Add protocol if missing
  if (!/^https?:\/\//.test(sanitized)) {
    sanitized = 'https://' + sanitized
  }
  
  if (!VALIDATION_RULES.url.test(sanitized)) {
    errors.push(new ValidationError('Invalid URL format', 'url', 'INVALID_FORMAT'))
  }
  
  // Security: Block suspicious URLs
  const suspiciousDomains = ['localhost', '127.0.0.1', '0.0.0.0', '192.168.']
  const hostname = new URL(sanitized).hostname.toLowerCase()
  if (suspiciousDomains.some(domain => hostname.includes(domain))) {
    errors.push(new ValidationError('Internal URLs not allowed', 'url', 'INTERNAL_URL'))
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: sanitized
  }
}

// Password validation with strength requirements
export function validatePassword(password: string): ValidationResult {
  const errors: ValidationError[] = []
  const rules = VALIDATION_RULES.password
  
  if (!password || typeof password !== 'string') {
    errors.push(new ValidationError('Password is required', 'password', 'REQUIRED'))
    return { isValid: false, errors }
  }
  
  if (password.length < rules.minLength) {
    errors.push(new ValidationError(
      `Password must be at least ${rules.minLength} characters`,
      'password',
      'TOO_SHORT'
    ))
  }
  
  if (rules.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push(new ValidationError(
      'Password must contain uppercase letters',
      'password',
      'MISSING_UPPERCASE'
    ))
  }
  
  if (rules.requireLowercase && !/[a-z]/.test(password)) {
    errors.push(new ValidationError(
      'Password must contain lowercase letters',
      'password',
      'MISSING_LOWERCASE'
    ))
  }
  
  if (rules.requireNumbers && !/\d/.test(password)) {
    errors.push(new ValidationError(
      'Password must contain numbers',
      'password',
      'MISSING_NUMBERS'
    ))
  }
  
  if (rules.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push(new ValidationError(
      'Password must contain special characters',
      'password',
      'MISSING_SPECIAL'
    ))
  }
  
  // Check against common weak passwords
  const weakPasswords = ['password', '123456', 'qwerty', 'admin', 'letmein']
  if (weakPasswords.includes(password.toLowerCase())) {
    errors.push(new ValidationError(
      'Password is too common',
      'password',
      'COMMON_PASSWORD'
    ))
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: password // Don't sanitize passwords
  }
}

// Business data validation
export function validateBusinessData(data: any): ValidationResult {
  const errors: ValidationError[] = []
  const sanitized: any = {}
  
  // Business name validation
  if (!data.business_name || typeof data.business_name !== 'string') {
    errors.push(new ValidationError('Business name is required', 'business_name', 'REQUIRED'))
  } else {
    sanitized.business_name = data.business_name.trim()
    if (sanitized.business_name.length < 2) {
      errors.push(new ValidationError(
        'Business name must be at least 2 characters',
        'business_name',
        'TOO_SHORT'
      ))
    }
  }
  
  // Business URL validation
  const urlValidation = validateUrl(data.business_url)
  if (!urlValidation.isValid) {
    errors.push(...urlValidation.errors)
  } else {
    sanitized.business_url = urlValidation.sanitizedData
  }
  
  // Email validation
  const emailValidation = validateEmail(data.business_email)
  if (!emailValidation.isValid) {
    errors.push(...emailValidation.errors)
  } else {
    sanitized.business_email = emailValidation.sanitizedData
  }
  
  // Description validation
  if (!data.business_description || typeof data.business_description !== 'string') {
    errors.push(new ValidationError('Business description is required', 'business_description', 'REQUIRED'))
  } else {
    sanitized.business_description = data.business_description.trim()
    if (sanitized.business_description.length < 20) {
      errors.push(new ValidationError(
        'Business description must be at least 20 characters',
        'business_description',
        'TOO_SHORT'
      ))
    }
    if (sanitized.business_description.length > 1000) {
      errors.push(new ValidationError(
        'Business description must be less than 1000 characters',
        'business_description',
        'TOO_LONG'
      ))
    }
  }
  
  // Optional phone validation
  if (data.business_phone) {
    const phone = data.business_phone.toString().trim()
    if (!VALIDATION_RULES.phone.test(phone)) {
      errors.push(new ValidationError('Invalid phone format', 'business_phone', 'INVALID_FORMAT'))
    } else {
      sanitized.business_phone = phone
    }
  }
  
  // Category validation
  const validCategories = [
    'business_general', 'local_business', 'tech_startups', 'ecommerce', 'saas',
    'healthcare', 'education', 'non_profit', 'real_estate', 'professional_services',
    'retail', 'restaurants', 'automotive', 'finance', 'legal'
  ]
  
  if (!data.business_category || !validCategories.includes(data.business_category)) {
    errors.push(new ValidationError(
      'Valid business category is required',
      'business_category',
      'INVALID_CATEGORY'
    ))
  } else {
    sanitized.business_category = data.business_category
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: sanitized
  }
}

// Rate limiting validation
export function validateRateLimit(
  identifier: string,
  limit: number,
  windowMs: number,
  requests: Map<string, { count: number; resetTime: number }>
): { allowed: boolean; resetTime: number; remaining: number } {
  const now = Date.now()
  const key = identifier
  const existing = requests.get(key)
  
  if (!existing || now > existing.resetTime) {
    // First request or window expired
    requests.set(key, { count: 1, resetTime: now + windowMs })
    return { allowed: true, resetTime: now + windowMs, remaining: limit - 1 }
  }
  
  if (existing.count >= limit) {
    // Rate limit exceeded
    return { allowed: false, resetTime: existing.resetTime, remaining: 0 }
  }
  
  // Increment counter
  existing.count++
  return { 
    allowed: true, 
    resetTime: existing.resetTime, 
    remaining: limit - existing.count 
  }
}

// Sanitize HTML content to prevent XSS
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') return ''
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim()
}

// Validate API key format
export function validateApiKey(key: string): ValidationResult {
  const errors: ValidationError[] = []
  
  if (!key || typeof key !== 'string') {
    errors.push(new ValidationError('API key is required', 'api_key', 'REQUIRED'))
    return { isValid: false, errors }
  }
  
  // API keys should be 64 characters, hex format
  if (!/^[a-f0-9]{64}$/.test(key)) {
    errors.push(new ValidationError('Invalid API key format', 'api_key', 'INVALID_FORMAT'))
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: key
  }
}

// Enhanced input sanitization for SQL injection prevention
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return ''
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/['";\\]/g, '') // Remove quotes and backslashes for SQL safety
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove block comments
    .replace(/\*\//g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
}

// Validate submission data comprehensively
export function validateSubmissionData(data: any): ValidationResult {
  const errors: ValidationError[] = []
  const sanitized: any = {}
  
  // Validate required fields
  if (!data.businessName) {
    errors.push(new ValidationError('Business name is required', 'businessName', 'REQUIRED'))
  } else {
    sanitized.businessName = sanitizeInput(data.businessName)
    if (sanitized.businessName.length < 2) {
      errors.push(new ValidationError('Business name too short', 'businessName', 'TOO_SHORT'))
    }
  }
  
  // URL validation
  const urlValidation = validateUrl(data.website)
  if (!urlValidation.isValid) {
    errors.push(...urlValidation.errors)
  } else {
    sanitized.website = urlValidation.sanitizedData
  }
  
  // Email validation
  const emailValidation = validateEmail(data.email)
  if (!emailValidation.isValid) {
    errors.push(...emailValidation.errors)
  } else {
    sanitized.email = emailValidation.sanitizedData
  }
  
  // Directory selection validation
  if (!data.directories || !Array.isArray(data.directories)) {
    errors.push(new ValidationError('Directories must be an array', 'directories', 'INVALID_TYPE'))
  } else if (data.directories.length === 0) {
    errors.push(new ValidationError('At least one directory required', 'directories', 'EMPTY_ARRAY'))
  } else if (data.directories.length > 100) {
    errors.push(new ValidationError('Too many directories selected', 'directories', 'TOO_MANY'))
  } else {
    sanitized.directories = data.directories.filter((id: any) => 
      typeof id === 'string' && id.length > 0
    ).slice(0, 100)
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: sanitized
  }
}

// IP address validation for security
export function validateIpAddress(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false
  
  // IPv4 pattern
  const ipv4Pattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  
  // IPv6 pattern (simplified)
  const ipv6Pattern = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
  
  return ipv4Pattern.test(ip) || ipv6Pattern.test(ip)
}

// User agent validation
export function validateUserAgent(userAgent: string): boolean {
  if (!userAgent || typeof userAgent !== 'string') return false
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /scraper/i,
    /spider/i,
    /scanner/i,
    /hack/i,
    /attack/i
  ]
  
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent))
  
  // Allow legitimate bots (Google, Bing, etc.)
  const legitimateBots = [
    /googlebot/i,
    /bingbot/i,
    /facebookexternalhit/i,
    /twitterbot/i,
    /linkedinbot/i
  ]
  
  const isLegitimate = legitimateBots.some(pattern => pattern.test(userAgent))
  
  return !isSuspicious || isLegitimate
}