// 🔒 ADVANCED DATA VALIDATION & SANITIZATION - Enterprise-grade input processing
// Comprehensive validation, sanitization, and security checks for all API inputs

import { ValidationError, Errors } from './errors'
import { logger } from './logger'
import { urlValidator, URLValidationResult } from './url-validator'

export interface ValidationRule {
  required?: boolean
  type?: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'phone' | 'date'
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: RegExp
  enum?: string[]
  custom?: (value: any) => Promise<boolean> | boolean
  sanitizer?: (value: any) => any
  errorMessage?: string
}

export interface ValidationSchema {
  [field: string]: ValidationRule
}

export interface ValidationContext {
  requestId: string
  userAgent?: string
  ipAddress?: string
  timestamp: number
  rateLimit?: {
    identifier: string
    limit: number
    window: number
  }
}

export interface ValidatedData {
  isValid: boolean
  data: Record<string, any>
  errors: ValidationError[]
  warnings: string[]
  metadata: {
    fieldsValidated: number
    fieldsModified: string[]
    sanitizationApplied: string[]
    validationTime: number
  }
}

export class AdvancedValidator {
  private suspiciousPatterns: RegExp[]
  private sqlInjectionPatterns: RegExp[]
  private xssPatterns: RegExp[]
  private profanityFilter: Set<string>
  private disposableEmailDomains: Set<string>

  constructor() {
    this.suspiciousPatterns = [
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,
      /onclick=/i,
      /<script/i,
      /<iframe/i,
      /<embed/i,
      /<object/i,
      /expression\(/i,
      /url\(/i,
      /import\(/i,
    ]

    this.sqlInjectionPatterns = [
      /union\s+select/i,
      /select\s+.*\s+from/i,
      /insert\s+into/i,
      /update\s+.*\s+set/i,
      /delete\s+from/i,
      /drop\s+table/i,
      /create\s+table/i,
      /alter\s+table/i,
      /exec\s*\(/i,
      /execute\s*\(/i,
      /xp_cmdshell/i,
      /sp_executesql/i,
      /--/,
      /\/\*/,
      /\*\//,
      /0x[0-9a-f]+/i,
      /char\s*\(/i,
      /convert\s*\(/i,
      /cast\s*\(/i,
    ]

    this.xssPatterns = [
      /<script.*?>.*?<\/script>/i,
      /<iframe.*?>/i,
      /<embed.*?>/i,
      /<object.*?>/i,
      /javascript:/i,
      /vbscript:/i,
      /expression\(/i,
      /onload\s*=/i,
      /onerror\s*=/i,
      /onclick\s*=/i,
      /onmouseover\s*=/i,
      /onfocus\s*=/i,
      /onblur\s*=/i,
    ]

    this.profanityFilter = new Set([
      // Add profanity words as needed
      'spam', 'fake', 'scam', 'phishing', 'malware'
    ])

    this.disposableEmailDomains = new Set([
      '10minutemail.com', 'tempmail.org', 'guerrillamail.com', 
      'mailinator.com', 'yopmail.com', 'temp-mail.org',
      '33mail.com', 'fakeinbox.com', 'throwaway.email'
    ])
  }

  async validate(
    data: Record<string, any>, 
    schema: ValidationSchema, 
    context: ValidationContext
  ): Promise<ValidatedData> {
    const startTime = Date.now()
    const result: ValidatedData = {
      isValid: true,
      data: {},
      errors: [],
      warnings: [],
      metadata: {
        fieldsValidated: 0,
        fieldsModified: [],
        sanitizationApplied: [],
        validationTime: 0
      }
    }

    try {
      logger.info('Advanced validation started', {
        requestId: context.requestId,
        metadata: {
          fieldsToValidate: Object.keys(schema).length,
          dataSize: JSON.stringify(data).length,
          userAgent: context.userAgent?.substring(0, 100)
        }
      })

      // Pre-validation security checks
      await this.performSecurityChecks(data, context, result)

      // Validate each field according to schema
      for (const [fieldName, rule] of Object.entries(schema)) {
        result.metadata.fieldsValidated++
        const fieldValue = data[fieldName]

        try {
          const fieldResult = await this.validateField(fieldName, fieldValue, rule, context)
          
          if (fieldResult.isValid) {
            result.data[fieldName] = fieldResult.value
            if (fieldResult.wasModified) {
              result.metadata.fieldsModified.push(fieldName)
            }
            if (fieldResult.sanitizationApplied) {
              result.metadata.sanitizationApplied.push(fieldName)
            }
            if (fieldResult.warnings) {
              result.warnings.push(...fieldResult.warnings)
            }
          } else {
            result.errors.push(...fieldResult.errors)
            result.isValid = false
          }

        } catch (error) {
          const validationError = new ValidationError(
            `Field validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            fieldName,
            'VALIDATION_FAILED'
          )
          result.errors.push(validationError)
          result.isValid = false

          logger.error('Field validation error', {
            requestId: context.requestId,
            metadata: { fieldName, error: validationError.message }
          }, error instanceof Error ? error : new Error(String(error)))
        }
      }

      // Cross-field validation
      await this.performCrossFieldValidation(result.data, schema, context, result)

      result.metadata.validationTime = Date.now() - startTime

      logger.info('Advanced validation completed', {
        requestId: context.requestId,
        metadata: {
          isValid: result.isValid,
          errorCount: result.errors.length,
          warningCount: result.warnings.length,
          fieldsModified: result.metadata.fieldsModified.length,
          validationTime: result.metadata.validationTime
        }
      })

      return result

    } catch (error) {
      result.isValid = false
      result.errors.push(new ValidationError(
        `Validation process failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'validation',
        'PROCESS_FAILED'
      ))

      logger.error('Validation process error', {
        requestId: context.requestId,
        metadata: { validationTime: Date.now() - startTime }
      }, error instanceof Error ? error : new Error(String(error)))

      return result
    }
  }

  private async validateField(
    fieldName: string, 
    value: any, 
    rule: ValidationRule, 
    context: ValidationContext
  ): Promise<{
    isValid: boolean
    value: any
    errors: ValidationError[]
    warnings?: string[]
    wasModified: boolean
    sanitizationApplied: boolean
  }> {
    const errors: ValidationError[] = []
    const warnings: string[] = []
    let processedValue = value
    let wasModified = false
    let sanitizationApplied = false

    // Required check
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(Errors.required(fieldName))
      return { isValid: false, value: processedValue, errors, wasModified, sanitizationApplied }
    }

    // Skip validation if value is empty and not required
    if (!rule.required && (value === undefined || value === null || value === '')) {
      return { isValid: true, value: processedValue, errors, wasModified, sanitizationApplied }
    }

    // Apply sanitizer first if provided
    if (rule.sanitizer) {
      const sanitized = rule.sanitizer(processedValue)
      if (sanitized !== processedValue) {
        processedValue = sanitized
        wasModified = true
        sanitizationApplied = true
      }
    }

    // Type validation and conversion
    if (rule.type) {
      const typeResult = await this.validateType(fieldName, processedValue, rule.type, context)
      if (!typeResult.isValid) {
        errors.push(...typeResult.errors)
      } else {
        processedValue = typeResult.value
        if (typeResult.wasModified) wasModified = true
        if (typeResult.warnings) warnings.push(...typeResult.warnings)
      }
    }

    // String-specific validations
    if (typeof processedValue === 'string') {
      // Security checks
      const securityResult = this.performStringSecurity(fieldName, processedValue)
      if (!securityResult.isValid) {
        errors.push(...securityResult.errors)
      }
      if (securityResult.warnings) {
        warnings.push(...securityResult.warnings)
      }

      // Length validation
      if (rule.minLength && processedValue.length < rule.minLength) {
        errors.push(Errors.tooShort(fieldName, rule.minLength))
      }
      if (rule.maxLength && processedValue.length > rule.maxLength) {
        errors.push(Errors.tooLong(fieldName, rule.maxLength))
      }

      // Pattern validation
      if (rule.pattern && !rule.pattern.test(processedValue)) {
        errors.push(Errors.invalid(fieldName, rule.errorMessage || 'Does not match required pattern'))
      }
    }

    // Number-specific validations
    if (typeof processedValue === 'number') {
      if (rule.min !== undefined && processedValue < rule.min) {
        errors.push(Errors.invalid(fieldName, `Must be at least ${rule.min}`))
      }
      if (rule.max !== undefined && processedValue > rule.max) {
        errors.push(Errors.invalid(fieldName, `Must be no more than ${rule.max}`))
      }
    }

    // Enum validation
    if (rule.enum && !rule.enum.includes(processedValue)) {
      errors.push(Errors.invalid(fieldName, `Must be one of: ${rule.enum.join(', ')}`))
    }

    // Custom validation
    if (rule.custom) {
      try {
        const isValid = await rule.custom(processedValue)
        if (!isValid) {
          errors.push(Errors.invalid(fieldName, rule.errorMessage || 'Custom validation failed'))
        }
      } catch (error) {
        errors.push(Errors.invalid(fieldName, `Custom validation error: ${error instanceof Error ? error.message : 'Unknown error'}`))
      }
    }

    return {
      isValid: errors.length === 0,
      value: processedValue,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
      wasModified,
      sanitizationApplied
    }
  }

  private async validateType(
    fieldName: string, 
    value: any, 
    type: ValidationRule['type'], 
    context: ValidationContext
  ): Promise<{
    isValid: boolean
    value: any
    errors: ValidationError[]
    warnings?: string[]
    wasModified: boolean
  }> {
    const errors: ValidationError[] = []
    const warnings: string[] = []
    let processedValue = value
    let wasModified = false

    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          processedValue = String(value)
          wasModified = true
        }
        processedValue = this.sanitizeString(processedValue)
        break

      case 'number':
        if (typeof value === 'string') {
          const parsed = parseFloat(value)
          if (isNaN(parsed)) {
            errors.push(Errors.invalid(fieldName, 'Must be a valid number'))
          } else {
            processedValue = parsed
            wasModified = true
          }
        } else if (typeof value !== 'number') {
          errors.push(Errors.invalid(fieldName, 'Must be a number'))
        }
        break

      case 'boolean':
        if (typeof value === 'string') {
          const lower = value.toLowerCase()
          if (['true', '1', 'yes', 'on'].includes(lower)) {
            processedValue = true
            wasModified = true
          } else if (['false', '0', 'no', 'off'].includes(lower)) {
            processedValue = false
            wasModified = true
          } else {
            errors.push(Errors.invalid(fieldName, 'Must be a valid boolean'))
          }
        } else if (typeof value !== 'boolean') {
          errors.push(Errors.invalid(fieldName, 'Must be a boolean'))
        }
        break

      case 'email':
        if (typeof value !== 'string') {
          errors.push(Errors.invalid(fieldName, 'Email must be a string'))
          break
        }
        const emailResult = await this.validateEmail(value)
        if (!emailResult.isValid) {
          errors.push(...emailResult.errors)
        } else {
          processedValue = emailResult.sanitizedEmail
          if (processedValue !== value) wasModified = true
          if (emailResult.warnings) warnings.push(...emailResult.warnings)
        }
        break

      case 'url':
        if (typeof value !== 'string') {
          errors.push(Errors.invalid(fieldName, 'URL must be a string'))
          break
        }
        const urlResult = await urlValidator.validateUrl(value)
        if (!urlResult.isValid) {
          errors.push(...urlResult.errors)
        } else {
          processedValue = urlResult.sanitizedUrl
          if (processedValue !== value) wasModified = true
          if (urlResult.warnings.length > 0) warnings.push(...urlResult.warnings)
        }
        break

      case 'phone':
        if (typeof value !== 'string') {
          errors.push(Errors.invalid(fieldName, 'Phone number must be a string'))
          break
        }
        const phoneResult = this.validatePhone(value)
        if (!phoneResult.isValid) {
          errors.push(Errors.invalid(fieldName, 'Invalid phone number format'))
        } else {
          processedValue = phoneResult.formatted
          if (processedValue !== value) wasModified = true
        }
        break

      case 'date':
        if (typeof value === 'string') {
          const parsed = new Date(value)
          if (isNaN(parsed.getTime())) {
            errors.push(Errors.invalid(fieldName, 'Invalid date format'))
          } else {
            processedValue = parsed.toISOString()
            wasModified = true
          }
        } else if (!(value instanceof Date)) {
          errors.push(Errors.invalid(fieldName, 'Must be a valid date'))
        }
        break
    }

    return {
      isValid: errors.length === 0,
      value: processedValue,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
      wasModified
    }
  }

  private async performSecurityChecks(
    data: Record<string, any>, 
    context: ValidationContext, 
    result: ValidatedData
  ): Promise<void> {
    const dataStr = JSON.stringify(data).toLowerCase()

    // Check for suspicious patterns
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(dataStr)) {
        result.warnings.push('Suspicious pattern detected in input data')
        break
      }
    }

    // Check for SQL injection attempts
    for (const pattern of this.sqlInjectionPatterns) {
      if (pattern.test(dataStr)) {
        result.errors.push(new ValidationError(
          'Potential SQL injection attempt detected',
          'security',
          'SQL_INJECTION_DETECTED'
        ))
        return
      }
    }

    // Check for XSS attempts
    for (const pattern of this.xssPatterns) {
      if (pattern.test(dataStr)) {
        result.errors.push(new ValidationError(
          'Potential XSS attempt detected',
          'security',
          'XSS_DETECTED'
        ))
        return
      }
    }

    // Check payload size
    if (dataStr.length > 10 * 1024 * 1024) { // 10MB
      result.errors.push(new ValidationError(
        'Request payload too large',
        'security',
        'PAYLOAD_TOO_LARGE'
      ))
    }

    // Check for profanity
    for (const word of Array.from(this.profanityFilter)) {
      if (dataStr.includes(word)) {
        result.warnings.push('Potentially inappropriate content detected')
        break
      }
    }
  }

  private performStringSecurity(fieldName: string, value: string): {
    isValid: boolean
    errors: ValidationError[]
    warnings?: string[]
  } {
    const errors: ValidationError[] = []
    const warnings: string[] = []

    // Check for suspicious patterns
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(value)) {
        errors.push(new ValidationError(
          `Suspicious content detected in ${fieldName}`,
          fieldName,
          'SUSPICIOUS_CONTENT'
        ))
        break
      }
    }

    // Check for SQL injection
    for (const pattern of this.sqlInjectionPatterns) {
      if (pattern.test(value)) {
        errors.push(new ValidationError(
          `Potential SQL injection in ${fieldName}`,
          fieldName,
          'SQL_INJECTION'
        ))
        break
      }
    }

    // Check for XSS
    for (const pattern of this.xssPatterns) {
      if (pattern.test(value)) {
        errors.push(new ValidationError(
          `Potential XSS attack in ${fieldName}`,
          fieldName,
          'XSS_ATTEMPT'
        ))
        break
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    }
  }

  private sanitizeString(value: string): string {
    return value
      .trim()
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .replace(/\s+/g, ' ') // Normalize whitespace
  }

  private async validateEmail(email: string): Promise<{
    isValid: boolean
    sanitizedEmail: string
    errors: ValidationError[]
    warnings?: string[]
  }> {
    const errors: ValidationError[] = []
    const warnings: string[] = []
    const sanitizedEmail = email.toLowerCase().trim()

    // Basic format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(sanitizedEmail)) {
      errors.push(Errors.invalid('email', 'Invalid email format'))
      return { isValid: false, sanitizedEmail, errors }
    }

    // Domain validation
    const domain = sanitizedEmail.split('@')[1]
    if (this.disposableEmailDomains.has(domain)) {
      errors.push(new ValidationError(
        'Disposable email addresses are not allowed',
        'email',
        'DISPOSABLE_EMAIL'
      ))
    }

    // Length validation
    if (sanitizedEmail.length > 254) {
      errors.push(Errors.tooLong('email', 254))
    }

    return {
      isValid: errors.length === 0,
      sanitizedEmail,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    }
  }

  private validatePhone(phone: string): { isValid: boolean; formatted: string } {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '')
    
    // Basic validation for US/International numbers
    if (digits.length >= 10 && digits.length <= 15) {
      // Format as international if starts with country code
      if (digits.length > 10) {
        return { isValid: true, formatted: `+${digits}` }
      } else {
        // Format as US number
        return { isValid: true, formatted: `+1${digits}` }
      }
    }

    return { isValid: false, formatted: phone }
  }

  private async performCrossFieldValidation(
    data: Record<string, any>,
    schema: ValidationSchema,
    context: ValidationContext,
    result: ValidatedData
  ): Promise<void> {
    // Example cross-field validations
    
    // Business URL and email domain consistency
    if (data.business_url && data.business_email) {
      try {
        const urlDomain = new URL(data.business_url).hostname.replace('www.', '')
        const emailDomain = data.business_email.split('@')[1]
        
        if (urlDomain !== emailDomain) {
          result.warnings.push('Business website domain does not match email domain')
        }
      } catch (error) {
        // URL parsing error - already handled in URL validation
      }
    }

    // Password and confirm password match
    if (data.password && data.confirmPassword) {
      if (data.password !== data.confirmPassword) {
        result.errors.push(new ValidationError(
          'Password confirmation does not match',
          'confirmPassword',
          'PASSWORDS_MISMATCH'
        ))
        result.isValid = false
      }
    }
  }
}

// Global validator instance
export const advancedValidator = new AdvancedValidator()

// Predefined schemas for common use cases
export const ValidationSchemas = {
  websiteAnalysis: {
    url: {
      required: true,
      type: 'url' as const,
      maxLength: 2048
    },
    options: {
      type: 'string' as const,
      sanitizer: (value: any) => {
        if (typeof value === 'object') return JSON.stringify(value)
        return String(value || '{}')
      },
      custom: async (value: string) => {
        try {
          JSON.parse(value)
          return true
        } catch {
          return false
        }
      },
      errorMessage: 'Options must be valid JSON'
    }
  },

  businessSubmission: {
    businessName: {
      required: true,
      type: 'string' as const,
      minLength: 2,
      maxLength: 100,
      pattern: /^[a-zA-Z0-9\s\-&.,'()]+$/,
      errorMessage: 'Business name contains invalid characters'
    },
    website: {
      required: true,
      type: 'url' as const
    },
    email: {
      required: true,
      type: 'email' as const
    },
    phone: {
      type: 'phone' as const
    },
    description: {
      required: true,
      type: 'string' as const,
      minLength: 20,
      maxLength: 1000
    },
    category: {
      required: true,
      type: 'string' as const,
      enum: [
        'business_general', 'local_business', 'tech_startups', 'ecommerce',
        'saas', 'healthcare', 'education', 'non_profit', 'real_estate',
        'professional_services', 'retail', 'restaurants', 'automotive',
        'finance', 'legal'
      ]
    },
    directories: {
      required: true,
      custom: async (value: any) => {
        return Array.isArray(value) && value.length > 0 && value.length <= 100
      },
      errorMessage: 'Must select 1-100 directories'
    }
  },

  userRegistration: {
    email: {
      required: true,
      type: 'email' as const
    },
    password: {
      required: true,
      type: 'string' as const,
      minLength: 8,
      maxLength: 128,
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      errorMessage: 'Password must contain uppercase, lowercase, number, and special character'
    },
    confirmPassword: {
      required: true,
      type: 'string' as const
    },
    businessName: {
      type: 'string' as const,
      maxLength: 100
    },
    acceptTerms: {
      required: true,
      type: 'boolean' as const,
      custom: async (value: boolean) => value === true,
      errorMessage: 'Must accept terms and conditions'
    }
  }
} as const