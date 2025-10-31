// Staff Authentication Middleware
// Validates staff authentication for API endpoints with secure session-based auth

import { NextApiRequest, NextApiResponse } from 'next'
import {
  resolveStaffApiKey,
  resolveStaffCredentials,
  resolveAdminApiKey,
  STAFF_SESSION_COOKIE,
  STAFF_SESSION_VALUE,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_VALUE,
} from '../auth/constants'

export interface StaffAuthResult {
  isAuthenticated: boolean
  user?: {
    id: string
    username: string
    email: string
    first_name: string
    last_name: string
    role: string
    permissions: {
      queue: boolean
      processing: boolean
      analytics: boolean
      support: boolean
    }
    method: string
  }
  error?: string
}

export function validateStaffAuth(req: NextApiRequest): StaffAuthResult {
  try {
    console.log('🔐 Validating staff authentication')
    
    // Check for staff API key in headers (highest priority)
    const staffKey = req.headers['x-staff-key'] || req.headers['authorization']
    const validStaffKey = resolveStaffApiKey()
    
    // Only evaluate API key path if a key is configured (or TEST_MODE provides fallback)
    if (validStaffKey && (staffKey === validStaffKey || staffKey === `Bearer ${validStaffKey}`)) {
      console.log('✅ Staff authenticated via API key')
      return {
        isAuthenticated: true,
        user: {
          id: 'staff-user',
          username: 'staff',
          email: 'ben.stone@directorybolt.com',
          first_name: 'BEN',
          last_name: 'STONE',
          role: 'manager',
          permissions: {
            queue: true,
            processing: true,
            analytics: true,
            support: true
          },
          method: 'api_key'
        }
      }
    }

    // Check for staff session cookie (secure session-based auth)
    const staffSession = req.cookies[STAFF_SESSION_COOKIE]
    if (staffSession === STAFF_SESSION_VALUE) {
      console.log('✅ Staff authenticated via secure session (staff)')
      return {
        isAuthenticated: true,
        user: {
          id: 'staff-user',
          username: 'staff',
          email: 'ben.stone@directorybolt.com',
          first_name: 'BEN',
          last_name: 'STONE',
          role: 'staff_manager',
          permissions: { queue: true, processing: true, analytics: true, support: true },
          method: 'session'
        }
      }
    }

    // Accept admin session as a superset for staff dashboard parity
    const adminSession = req.cookies[ADMIN_SESSION_COOKIE]
    if (adminSession === ADMIN_SESSION_VALUE) {
      console.log('✅ Staff authenticated via secure session (admin)')
      return {
        isAuthenticated: true,
        user: {
          id: 'admin-user',
          username: 'admin',
          email: 'ben.stone@directorybolt.com',
          first_name: 'Admin',
          last_name: 'User',
          role: 'admin_manager',
          permissions: { queue: true, processing: true, analytics: true, support: true },
          method: 'session_admin'
        }
      }
    }

    // Accept admin API key as alternative (parity with guards.ts)
    const providedAdminKey = (req.headers['x-admin-key'] as string) || (req.headers['authorization'] as string)
    const validAdminKey = resolveAdminApiKey()
    if (validAdminKey && (providedAdminKey === validAdminKey || providedAdminKey === `Bearer ${validAdminKey}`)) {
      console.log('✅ Staff authenticated via admin API key')
      return {
        isAuthenticated: true,
        user: {
          id: 'admin-user',
          username: 'admin',
          email: 'ben.stone@directorybolt.com',
          first_name: 'Admin',
          last_name: 'User',
          role: 'admin_manager',
          permissions: { queue: true, processing: true, analytics: true, support: true },
          method: 'api_key_admin'
        }
      }
    }

    // Check for basic auth credentials (using constants with TEST_MODE fallback)
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Basic ')) {
      const credentials = Buffer.from(authHeader.slice(6), 'base64').toString()
      const [username, password] = credentials.split(':')
      
      // Resolve credentials via constants to support TEST_MODE fallbacks
      const creds = resolveStaffCredentials()
      const validUsername = creds?.username
      const validPassword = creds?.password
      
      if (validUsername && validPassword && username === validUsername && password === validPassword) {
        console.log('✅ Staff authenticated via basic auth')
        return {
          isAuthenticated: true,
          user: {
            id: 'staff-user',
            username: 'staff',
            email: 'ben.stone@directorybolt.com',
            first_name: 'BEN',
            last_name: 'STONE',
            role: 'manager',
            permissions: {
              queue: true,
              processing: true,
              analytics: true,
              support: true
            },
            method: 'basic_auth'
          }
        }
      }
    }

    console.log('❌ Staff authentication failed - no valid credentials')
    return {
      isAuthenticated: false,
      error: 'Staff authentication required'
    }

  } catch (error) {
    console.error('❌ Staff auth validation error:', error)
    return {
      isAuthenticated: false,
      error: 'Authentication validation failed'
    }
  }
}

export function withStaffAuth(handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const authResult = validateStaffAuth(req)
    
    if (!authResult.isAuthenticated) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: authResult.error || 'Staff authentication required',
        statusCode: 401
      })
    }

    // Add user info to request object for use in handler
    ;(req as any).staffUser = authResult.user

    return handler(req, res)
  }
}
