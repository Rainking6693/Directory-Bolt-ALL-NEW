// CSRF Protection Middleware
// Implements CSRF protection for state-changing operations

import { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'

// In-memory store for CSRF tokens (in production, use Redis or database)
const csrfTokens = new Map<string, { token: string; expires: number }>()

export interface CSRFConfig {
  tokenLength?: number
  tokenExpiry?: number // in milliseconds
  allowedOrigins?: string[]
  requireOrigin?: boolean
}

const defaultConfig: Required<CSRFConfig> = {
  tokenLength: 32,
  tokenExpiry: 60 * 60 * 1000, // 1 hour
  allowedOrigins: ['http://localhost:3000', 'http://localhost:3001', 'https://directorybolt.com'],
  requireOrigin: true
}

export function generateCSRFToken(): string {
  return crypto.randomBytes(defaultConfig.tokenLength).toString('hex')
}

export function validateCSRFToken(token: string): boolean {
  const tokenRecord = csrfTokens.get(token)
  if (!tokenRecord) {
    return false
  }
  
  // Check if token has expired
  if (Date.now() > tokenRecord.expires) {
    csrfTokens.delete(token)
    return false
  }
  
  return true
}

export function storeCSRFToken(token: string): void {
  csrfTokens.set(token, {
    token,
    expires: Date.now() + defaultConfig.tokenExpiry
  })
}

export function withCSRFProtection(config: Partial<CSRFConfig> = {}) {
  const finalConfig = { ...defaultConfig, ...config }
  
  return function(handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>) {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      // Skip CSRF protection for GET requests
      if (req.method === 'GET') {
        return handler(req, res)
      }

      // Check Origin header
      if (finalConfig.requireOrigin) {
        const origin = req.headers.origin
        if (!origin || !finalConfig.allowedOrigins.includes(origin)) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Invalid origin',
            statusCode: 403
          })
        }
      }

      // Check CSRF token
      const csrfToken = req.headers['x-csrf-token'] as string
      if (!csrfToken || !validateCSRFToken(csrfToken)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Invalid or missing CSRF token',
          statusCode: 403
        })
      }

      return handler(req, res)
    }
  }
}

// Helper function to get CSRF token for frontend
export function getCSRFToken(): string {
  const token = generateCSRFToken()
  storeCSRFToken(token)
  return token
}

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now()
  for (const [token, record] of csrfTokens.entries()) {
    if (now > record.expires) {
      csrfTokens.delete(token)
    }
  }
}, 5 * 60 * 1000) // Clean up every 5 minutes
