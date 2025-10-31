// 🔒 INPUT SANITIZATION UTILITIES - Prevent XSS and injection attacks
// Security utilities for sanitizing user input across all API endpoints

import validator from 'validator'
import DOMPurify from 'isomorphic-dompurify'

/**
 * Sanitize general text input to prevent XSS attacks
 * @param input - The input string to sanitize
 * @returns Sanitized string safe for processing and storage
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return ''
  }

  // Remove any HTML tags and sanitize
  const sanitized = DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [] // No attributes allowed
  })

  // Additional XSS prevention - remove script-related content
  return sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
}

/**
 * Sanitize and validate email addresses
 * @param email - The email to sanitize and validate
 * @returns Sanitized email or empty string if invalid
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return ''
  }

  const sanitized = sanitizeInput(email).toLowerCase()
  
  // Additional email validation
  if (!validator.isEmail(sanitized)) {
    return ''
  }

  return sanitized
}

/**
 * Sanitize and validate URLs
 * @param url - The URL to sanitize and validate
 * @returns Sanitized URL or empty string if invalid
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return ''
  }

  const sanitized = sanitizeInput(url).toLowerCase()
  
  // Ensure URL has protocol
  const urlWithProtocol = sanitized.startsWith('http') ? sanitized : `https://${sanitized}`
  
  try {
    const urlObj = new URL(urlWithProtocol)
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return ''
    }
    
    // Validate domain format
    if (!validator.isFQDN(urlObj.hostname)) {
      return ''
    }
    
    return urlObj.toString()
  } catch {
    return ''
  }
}

/**
 * Sanitize numeric input and convert to number
 * @param input - The numeric input to sanitize
 * @returns Sanitized number or null if invalid
 */
export function sanitizeNumber(input: string | number): number | null {
  if (typeof input === 'number') {
    return isNaN(input) ? null : input
  }
  
  if (!input || typeof input !== 'string') {
    return null
  }

  const sanitized = sanitizeInput(input)
  const number = parseFloat(sanitized)
  
  return isNaN(number) ? null : number
}

/**
 * Sanitize phone numbers
 * @param phone - The phone number to sanitize
 * @returns Sanitized phone number or empty string if invalid
 */
export function sanitizePhone(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    return ''
  }

  const sanitized = sanitizeInput(phone)
  
  // Remove all non-digit characters except +, -, (), and spaces
  const cleaned = sanitized.replace(/[^\d\+\-\(\)\s]/g, '')
  
  // Basic phone validation - must have at least 10 digits
  const digits = cleaned.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) {
    return ''
  }
  
  return cleaned.trim()
}

/**
 * Sanitize SQL query parameters to prevent injection
 * @param input - The SQL parameter to sanitize
 * @returns Sanitized parameter safe for SQL queries
 */
export function sanitizeSqlParam(input: string): string {
  if (!input || typeof input !== 'string') {
    return ''
  }

  // Basic SQL injection prevention
  return sanitizeInput(input)
    .replace(/['";\\]/g, '') // Remove dangerous SQL characters
    .replace(/(-{2}|\/\*|\*\/)/g, '') // Remove SQL comment patterns
    .replace(/\b(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|EXEC|EXECUTE|UNION|SELECT|FROM|WHERE)\b/gi, '') // Remove SQL keywords
    .trim()
}

/**
 * Validate and sanitize business data
 * @param data - Object containing business form data
 * @returns Sanitized business data object
 */
export function sanitizeBusinessData(data: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {}
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      // Apply appropriate sanitization based on field type
      if (key.toLowerCase().includes('email')) {
        sanitized[key] = sanitizeEmail(value)
      } else if (key.toLowerCase().includes('url') || key.toLowerCase().includes('website')) {
        sanitized[key] = sanitizeUrl(value)
      } else if (key.toLowerCase().includes('phone')) {
        sanitized[key] = sanitizePhone(value)
      } else {
        sanitized[key] = sanitizeInput(value)
      }
    } else if (typeof value === 'number') {
      sanitized[key] = sanitizeNumber(value)
    } else if (value === null || value === undefined) {
      sanitized[key] = null
    } else {
      // For complex objects, apply recursive sanitization
      sanitized[key] = Array.isArray(value) 
        ? value.map(item => typeof item === 'string' ? sanitizeInput(item) : item)
        : value
    }
  }
  
  return sanitized
}