// 🔒 API BUILD SAFETY UTILITY - Prevent Next.js build-time execution errors
// Provides utilities to safely handle API routes during static generation

import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Checks if code is running during build time and prevents API execution
 * Returns true if execution should continue, false if it should skip
 */
export function isBuildTimeSafe(req: NextApiRequest, res: NextApiResponse): boolean {
  // Prevent execution during build time - Next.js static generation fix
  if (!req || !res || typeof res.status !== 'function') {
    console.warn('API route called during build time - skipping execution')
    return false
  }
  return true
}

/**
 * Safely sets response headers with build-time protection
 */
export function setHeaderSafely(res: NextApiResponse, key: string, value: string): void {
  try {
    res.setHeader(key, value)
  } catch (error) {
    console.warn(`Unable to set header '${key}' during build time:`, 
      error instanceof Error ? error.message : 'Unknown error')
  }
}

/**
 * Wrapper for API handlers that provides build-time protection
 * Use this to wrap your main API handler function
 */
export function withBuildTimeSafety<T = any>(
  handler: (req: NextApiRequest, res: NextApiResponse<T>) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse<T>) => {
    // Check build-time safety first
    if (!isBuildTimeSafe(req, res)) {
      return { notFound: true }
    }

    // Set JSON content type safely
    setHeaderSafely(res, 'Content-Type', 'application/json')
    
    try {
      await handler(req, res)
      return
    } catch (error) {
      console.error('API handler error:', error)
      
      // Safe error response
      try {
        if (!res.headersSent) {
          const errorResponse = {
            success: false as const,
            error: {
              message: 'Internal server error',
              statusCode: 500,
              timestamp: new Date().toISOString()
            }
          }
          res.status(500).json(errorResponse as T)
        }
      } catch (responseError) {
        console.error('Failed to send error response:', responseError)
      }
      return
    }
  }
}

/**
 * Safe environment variable access during build time
 * Returns fallback value if environment variable is not available
 */
export function getEnvSafely(key: string, fallback: string = ''): string {
  try {
    return process.env[key] || fallback
  } catch (error) {
    console.warn(`Unable to access environment variable '${key}' during build time`)
    return fallback
  }
}

/**
 * Checks if we're in a build environment (CI/CD, Netlify, etc.)
 */
export function isBuildEnvironment(): boolean {
  return !!(
    process.env.CI ||
    process.env.NETLIFY ||
    process.env.BUILDING ||
    process.env.BUILD_MODE ||
    process.env.NODE_ENV === 'test' ||
    typeof window !== 'undefined'
  )
}

/**
 * Safe module initialization for build time
 * Wraps potentially problematic imports/initializations
 */
export function safeInitialize<T>(
  initializer: () => T,
  fallback: T,
  errorMessage?: string
): T {
  try {
    // Skip initialization during build time
    if (isBuildEnvironment()) {
      console.warn(errorMessage || 'Skipping initialization during build time')
      return fallback
    }
    
    return initializer()
  } catch (error) {
    console.warn(
      errorMessage || 'Initialization failed',
      error instanceof Error ? error.message : 'Unknown error'
    )
    return fallback
  }
}

/**
 * Build-safe method validator for API routes
 * Ensures proper HTTP methods and sets appropriate headers
 */
export function validateMethod(
  req: NextApiRequest,
  res: NextApiResponse,
  allowedMethods: string[]
): boolean {
  if (!req.method || !allowedMethods.includes(req.method)) {
    setHeaderSafely(res, 'Allow', allowedMethods.join(', '))
    
    try {
      if (!res.headersSent) {
        res.status(405).json({
          success: false,
          error: {
            message: `Method ${req.method} not allowed`,
            statusCode: 405,
            allowedMethods,
            timestamp: new Date().toISOString()
          }
        })
      }
    } catch (responseError) {
      console.warn('Failed to send method not allowed response:', responseError)
    }
    
    return false
  }
  
  return true
}

/**
 * Create a request ID safely
 */
export function createRequestId(prefix: string = 'req'): string {
  try {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  } catch (error) {
    return `${prefix}_${Date.now()}_fallback`
  }
}