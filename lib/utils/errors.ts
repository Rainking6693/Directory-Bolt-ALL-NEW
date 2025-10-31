/**
 * Custom Error Classes for DirectoryBolt
 */

export class RateLimitError extends Error {
  public retryAfter?: number
  public remaining?: number
  constructor(messageOrRetryAfter?: string | number, retryAfterOrRemaining?: number) {
    const message = typeof messageOrRetryAfter === 'string' ? messageOrRetryAfter : 'Rate limit exceeded'
    super(message)
    this.name = 'RateLimitError'
    if (typeof messageOrRetryAfter === 'number') {
      this.retryAfter = messageOrRetryAfter
    }
    if (typeof retryAfterOrRemaining === 'number') {
      this.remaining = retryAfterOrRemaining
    }
  }
}

export class ValidationError extends Error {
  field?: string
  code?: string
  // Accept flexible argument patterns used across the repo: (message), (message, field), (message, field, code)
  constructor(...args: any[]) {
    const message = args && args.length > 0 ? String(args[0]) : 'Validation error'
    super(message)
    this.name = 'ValidationError'
    if (args.length > 1) this.field = args[1]
    if (args.length > 2) this.code = args[2]
  }
}

export class AuthenticationError extends Error {
  public errorCode?: string
  constructor(...args: any[]) {
    const message = args && args.length > 0 ? String(args[0]) : 'Authentication error'
    super(message)
    this.name = 'AuthenticationError'
    if (args.length > 1) this.errorCode = args[1]
  }
}

export class AirtableError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message)
    this.name = 'AirtableError'
  }
}

export class AuthorizationError extends Error {
  public errorCode?: string
  constructor(...args: any[]) {
    const message = args && args.length > 0 ? String(args[0]) : 'Authorization error'
    super(message)
    this.name = 'AuthorizationError'
    if (args.length > 1) this.errorCode = args[1]
  }
}

export function handleApiError(error: any, context?: any) {
  // Flexible handler used in two patterns across the codebase:
  // 1) Called as handleApiError(error, res) to send the response directly
  // 2) Called as handleApiError(error, requestId) to get a structured error object

  const statusCode = error && (error.statusCode || error.httpStatus || 500) || 500
  const payload = {
    error: {
      message: error && (error.message || String(error)) || 'Internal server error',
      statusCode
    }
  }

  // If context looks like a Next.js/Express response object, write the response
  if (context && typeof context === 'object' && typeof context.status === 'function' && typeof context.json === 'function') {
    // Attach additional details for known error types
    if (error instanceof ValidationError) {
      return context.status(400).json({ error: error.message, field: error.field })
    }
    if (error instanceof AuthorizationError) {
      return context.status(403).json({ error: error.message })
    }
    if (error instanceof AuthenticationError) {
      return context.status(401).json({ error: error.message })
    }
    if (error instanceof RateLimitError) {
      return context.status(429).json({ error: error.message, retryAfter: error.retryAfter })
    }
    return context.status(statusCode).json(payload)
  }

  // Otherwise return a structured object for caller to use
  return payload
}

export class ApiError extends Error {
  constructor(message: string, public statusCode: number = 500) {
    super(message)
    this.name = 'ApiError'
  }
}

export class ExternalServiceError extends Error {
  constructor(message: string, public service?: string) {
    super(message)
    this.name = 'ExternalServiceError'
  }
}

const _Errors: any = {
  RateLimitError,
  ValidationError,
  AuthenticationError,
  AirtableError,
  AuthorizationError,
  ApiError,
  ExternalServiceError
}

// Add helper factory methods to match call-sites across the codebase
_Errors.required = (field: string) => new ValidationError(`${field} is required`, field)
_Errors.invalid = (field: string, message?: string) => new ValidationError(message || `${field} is invalid`, field)
_Errors.submissionLimitReached = (limit: number) => new ValidationError(`Submission limit of ${limit} reached`)
_Errors.insufficientCredits = (required: number, available: number) => new ValidationError(`Insufficient credits: required ${required}, available ${available}`)
_Errors.directoryNotFound = () => new ValidationError('Directory not found')
_Errors.directoryInactive = () => new ValidationError('Directory is inactive')
_Errors.duplicateSubmission = () => new ValidationError('Duplicate submission detected')
_Errors.userNotFound = () => new ValidationError('User not found')

// Export typed Errors with helpers for both named and default imports
export type ErrorsWithHelpers = typeof _Errors & {
  required: (field: string) => ValidationError
  invalid: (field: string, message?: string) => ValidationError
  submissionLimitReached: (limit: number) => ValidationError
  insufficientCredits: (required: number, available: number) => ValidationError
  directoryNotFound: () => ValidationError
  directoryInactive: () => ValidationError
  duplicateSubmission: () => ValidationError
  userNotFound: () => ValidationError
}

export const Errors = _Errors as ErrorsWithHelpers
export default Errors