// Flexible ambient declarations for canonical errors module.
// Constructors accept variable argument patterns used across the codebase
// (e.g. `new ValidationError(message)`, `new ValidationError(message, field)`, `new ValidationError(message, field, code)`).
declare class ValidationError extends Error {
  constructor(...args: any[])
  field?: string
  code?: string
}

declare class AuthorizationError extends Error {
  constructor(...args: any[])
  code?: string
}

declare class AuthenticationError extends Error {
  constructor(...args: any[])
  code?: string
}

declare class RateLimitError extends Error {
  constructor(...args: any[])
  resetIn?: number
  remaining?: number
}

declare class ApiError extends Error { constructor(...args: any[]) }
declare class ExternalServiceError extends Error { constructor(...args: any[]) }

// Errors helper shape: include commonly-used helper factory methods so call-sites
// that reference `Errors.required`, `Errors.invalid`, etc. type-check cleanly.
declare interface ErrorsType {
  RateLimitError: typeof RateLimitError
  ValidationError: typeof ValidationError
  AuthenticationError: typeof AuthenticationError
  AirtableError: any
  AuthorizationError: typeof AuthorizationError
  ApiError: typeof ApiError
  ExternalServiceError: typeof ExternalServiceError

  // Helper factories used throughout the codebase
  required(field: string): ValidationError
  invalid(field: string, message?: string): ValidationError
  submissionLimitReached(limit: number): RateLimitError
  insufficientCredits(required: number, available?: number): AuthorizationError
  userNotFound(): AuthenticationError
  directoryNotFound(): Error
  directoryInactive(): Error
  duplicateSubmission(): Error
}

declare const Errors: ErrorsType

export default Errors
