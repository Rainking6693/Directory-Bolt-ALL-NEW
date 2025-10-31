// Temporary Errors shim to provide commonly used validation error helpers.
// This file reduces cascade failures during type-check and can be replaced
// with the project's canonical `Errors` implementation later.

// Temporary re-export of the canonical Errors module to prevent duplicate type definitions
export { ValidationError } from './errors'
import ErrorsModule from './errors'
export const Errors = ErrorsModule
export default ErrorsModule
