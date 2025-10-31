/**
 * Admin Authentication Utility
 * Simple authentication helper for admin API endpoints
 * 
 * SECURITY FIX for CRITICAL-002: Admin Routes Lack Authorization Validation
 * This utility provides authentication checks for all admin API routes
 * 
 * Author: Quinn (Security Specialist)
 */

import { NextApiRequest, NextApiResponse } from 'next'

export interface AdminAuthResult {
  authenticated: boolean
  user?: {
    role: string
    email?: string
    method: string
  }
  error?: string
}

/**
 * Authenticate admin request using the same logic as the fixed auth-check endpoint
 * This replicates the authentication system fixed by Frank in CRITICAL-001
 */
export async function authenticateAdmin(req: NextApiRequest): Promise<AdminAuthResult> {
  try {
    console.log('🔐 Admin auth check requested from IP:', req.headers['x-forwarded-for'] || req.socket.remoteAddress)
    
    // Check for admin API key in headers (highest priority)
    const adminKey = req.headers['x-admin-key'] || req.headers['authorization']
    const validAdminKey = process.env.ADMIN_API_KEY
    
    if (!validAdminKey) {
      console.log('❌ Admin authentication failed - ADMIN_API_KEY environment variable not set')
      return {
        authenticated: false,
        error: 'Admin authentication configuration error - missing ADMIN_API_KEY'
      }
    }
    
    if (adminKey === validAdminKey || adminKey === `Bearer ${validAdminKey}`) {
      console.log('✅ Admin authenticated via API key')
      return {
        authenticated: true,
        user: { role: 'admin', method: 'api_key' }
      }
    }

    // Check for admin session/cookie
    const adminSession = req.cookies?.['admin-session'] || 
      (req.headers.cookie && parseCookie(req.headers.cookie, 'admin-session'))
    const validAdminSession = process.env.ADMIN_SESSION_TOKEN
    
    if (validAdminSession && adminSession === validAdminSession) {
      console.log('✅ Admin authenticated via session')
      return {
        authenticated: true,
        user: { role: 'admin', method: 'session' }
      }
    }

    // Check for basic auth credentials
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Basic ')) {
      const credentials = Buffer.from(authHeader.slice(6), 'base64').toString()
      const [username, password] = credentials.split(':')
      
      const validUsername = process.env.ADMIN_USERNAME
      const validPassword = process.env.ADMIN_PASSWORD
      
      if (!validUsername || !validPassword) {
        console.log('❌ Admin authentication failed - ADMIN_USERNAME or ADMIN_PASSWORD environment variables not set')
        return {
          authenticated: false,
          error: 'Admin authentication configuration error - missing basic auth credentials'
        }
      }
      
      if (username === validUsername && password === validPassword) {
        console.log('✅ Admin authenticated via basic auth')
        return {
          authenticated: true,
          user: { role: 'admin', email: 'admin@directorybolt.com', method: 'basic_auth' }
        }
      }
    }

    // No valid admin authentication found
    console.log('❌ Admin authentication failed - no valid credentials')
    return {
      authenticated: false,
      error: 'Admin authentication required'
    }
  } catch (error) {
    console.error('Admin authentication error:', error)
    return {
      authenticated: false,
      error: 'Authentication processing error'
    }
  }
}

/**
 * Helper function to parse cookies from cookie header
 */
function parseCookie(cookieHeader: string, cookieName: string): string | undefined {
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=')
    if (key && value) {
      acc[key] = value
    }
    return acc
  }, {} as Record<string, string>)
  
  return cookies[cookieName]
}

/**
 * Middleware function to require admin authentication
 * Returns 401 if not authenticated, otherwise continues to the handler
 */
export function requireAdminAuth(handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    console.log(`🔒 Admin auth required for ${req.method} ${req.url}`)
    
    const authResult = await authenticateAdmin(req)
    
    if (!authResult.authenticated) {
      console.log(`❌ Admin auth failed: ${authResult.error}`)
      return res.status(401).json({
        error: 'Unauthorized',
        message: authResult.error || 'Admin authentication required',
        statusCode: 401
      })
    }

    console.log(`✅ Admin authenticated: ${authResult.user?.method} (${authResult.user?.role})`)
    
    // Call the original handler
    return handler(req, res)
  }
}

/**
 * Simple function to check admin auth and return 401 if failed
 * Use this in existing handlers for minimal code changes
 */
export async function verifyAdminAuth(req: NextApiRequest, res: NextApiResponse): Promise<boolean> {
  const authResult = await authenticateAdmin(req)
  
  if (!authResult.authenticated) {
    res.status(401).json({
      error: 'Unauthorized',
      message: authResult.error || 'Admin authentication required',
      statusCode: 401
    })
    return false
  }
  
  return true
}