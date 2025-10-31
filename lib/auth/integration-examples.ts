// 🔒 JORDAN'S AUTHENTICATION INTEGRATION EXAMPLES
// Complete examples showing how to use the authentication system

import type { NextApiRequest, NextApiResponse } from 'next'
import { authMiddleware, type AuthenticatedRequest } from './middleware'
import { getUserRole, enforcePermission, hasPermission } from './rbac'
import { jwtManager } from './jwt'
import { sessionManager } from './session-manager'
import { apiKeyManager } from './api-keys'

/**
 * Example 1: Protected API Route with Authentication
 * Demonstrates basic authentication requirement
 */
export async function protectedRouteExample(
  req: NextApiRequest,
  res: NextApiResponse
) {
  await authMiddleware({ 
    requireAuth: true, 
    requireVerified: true 
  })(req as AuthenticatedRequest, res, async () => {
    const authenticatedReq = req as AuthenticatedRequest
    
    res.json({
      message: 'Access granted!',
      user: {
        id: authenticatedReq.user!.id,
        email: authenticatedReq.user!.email,
        role: authenticatedReq.role
      }
    })
  })
}

/**
 * Example 2: Admin-Only Route
 * Demonstrates role-based access control
 */
export async function adminOnlyRouteExample(
  req: NextApiRequest,
  res: NextApiResponse
) {
  await authMiddleware({ 
    requireAuth: true,
    allowedRoles: ['admin'],
    requiredPermission: 'system:admin'
  })(req as AuthenticatedRequest, res, async () => {
    const authenticatedReq = req as AuthenticatedRequest
    
    res.json({
      message: 'Admin access granted!',
      adminUser: authenticatedReq.user!.email,
      systemInfo: {
        timestamp: new Date().toISOString(),
        permissions: ['full_access']
      }
    })
  })
}

/**
 * Example 3: Subscription Tier-Based Access
 * Demonstrates subscription-based feature gating
 */
export async function premiumFeatureExample(
  req: NextApiRequest,
  res: NextApiResponse
) {
  await authMiddleware({ 
    requireAuth: true,
    requiredPermission: 'analytics:read'
  })(req as AuthenticatedRequest, res, async () => {
    const authenticatedReq = req as AuthenticatedRequest
    const user = authenticatedReq.user!
    
    // Check if user has premium tier for advanced analytics
    const allowedTiers = ['professional', 'enterprise']
    if (!allowedTiers.includes(user.subscription_tier)) {
      return res.status(403).json({
        error: 'Premium subscription required for this feature',
        currentTier: user.subscription_tier,
        requiredTiers: allowedTiers,
        upgradeUrl: '/pricing'
      })
    }
    
    res.json({
      message: 'Premium analytics data',
      data: {
        advanced_metrics: true,
        user_tier: user.subscription_tier,
        feature_access: 'full'
      }
    })
  })
}

/**
 * Example 4: API Key Authentication for AutoBolt
 * Demonstrates API key-based authentication for external tools
 */
export async function autoBoltApiExample(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const apiKey = req.headers['x-api-key'] as string
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      message: 'Include your API key in the X-API-Key header'
    })
  }

  const validation = await apiKeyManager.validateApiKey(
    apiKey,
    req.headers['x-forwarded-for'] as string || req.socket.remoteAddress,
    req.headers.referer
  )

  if (!validation.isValid || !validation.user || !validation.apiKey) {
    return res.status(401).json({
      error: 'Invalid API key',
      message: 'The provided API key is invalid, expired, or revoked'
    })
  }

  // Check if API key has required permissions
  if (!validation.apiKey.permissions.includes('create_submissions')) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: 'API key does not have permission to create submissions'
    })
  }

  // Track API usage
  await apiKeyManager.trackUsage(
    validation.apiKey.id,
    req.url || '/api/autobolt/submit',
    req.method || 'POST',
    req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown',
    200,
    Date.now() - Date.now(), // Would be actual processing time
    req.headers['user-agent']
  )

  res.json({
    message: 'AutoBolt API access granted',
    user: {
      id: validation.user.id,
      tier: validation.user.subscription_tier
    },
    rateLimits: validation.rateLimitStatus
  })
}

/**
 * Example 5: Session Management in Component
 * Client-side session management example
 */
export const useAuthExample = `
import { useEffect, useState } from 'react'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include' // Include cookies
      })
      
      if (response.ok) {
        const userData = await response.json()
        setUser(userData.data.user)
      } else {
        setUser(null)
      }
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password, rememberMe = false) => {
    try {
      setLoading(true)
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, remember_me: rememberMe })
      })

      const data = await response.json()
      
      if (response.ok) {
        setUser(data.data.user)
        return { success: true }
      } else {
        throw new Error(data.error.message)
      }
    } catch (err) {
      setError(err)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }

  const logout = async (logoutFromAllDevices = false) => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ logoutFromAllDevices })
      })
      setUser(null)
    } catch (err) {
      setError(err)
    }
  }

  const refreshToken = async () => {
    try {
      const response = await fetch('/api/auth/refresh-token', {
        method: 'POST',
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setUser(data.data.user)
        return true
      }
      return false
    } catch (err) {
      setError(err)
      return false
    }
  }

  return {
    user,
    loading,
    error,
    login,
    logout,
    refreshToken,
    checkAuthStatus
  }
}
`

/**
 * Example 6: Dashboard Integration with Session Management
 * Shows how to integrate with existing dashboard components
 */
export const dashboardIntegrationExample = `
// pages/dashboard.tsx
import { useAuth } from '../hooks/useAuth'
import { useEffect, useState } from 'react'

export default function Dashboard() {
  const { user, loading, error } = useAuth()
  const [sessions, setSessions] = useState([])
  const [apiKeys, setApiKeys] = useState([])

  useEffect(() => {
    if (user) {
      fetchSessions()
      fetchApiKeys()
    }
  }, [user])

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/auth/sessions', {
        credentials: 'include'
      })
      const data = await response.json()
      if (data.success) {
        setSessions(data.data.sessions)
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err)
    }
  }

  const fetchApiKeys = async () => {
    try {
      const response = await fetch('/api/auth/api-keys', {
        credentials: 'include'
      })
      const data = await response.json()
      if (data.success) {
        setApiKeys(data.data.apiKeys)
      }
    } catch (err) {
      console.error('Failed to fetch API keys:', err)
    }
  }

  const revokeSession = async (sessionId) => {
    try {
      const response = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId })
      })
      
      if (response.ok) {
        fetchSessions() // Refresh sessions
      }
    } catch (err) {
      console.error('Failed to revoke session:', err)
    }
  }

  const createApiKey = async (name, permissions) => {
    try {
      const response = await fetch('/api/auth/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          permissions,
          description: 'Generated for AutoBolt extension'
        })
      })
      
      const data = await response.json()
      if (data.success) {
        // Show the API key to user (only shown once)
        alert('Your API key: ' + data.data.plainKey + ' - Save it securely!')
        fetchApiKeys() // Refresh list
      }
    } catch (err) {
      console.error('Failed to create API key:', err)
    }
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  if (!user) return <div>Please log in</div>

  return (
    <div className="dashboard">
      <h1>Welcome, {user.full_name}!</h1>
      
      <div className="user-info">
        <p>Email: {user.email}</p>
        <p>Subscription: {user.subscription_tier}</p>
        <p>Credits: {user.credits_remaining}</p>
      </div>

      <div className="active-sessions">
        <h2>Active Sessions</h2>
        {sessions.map(session => (
          <div key={session.id} className="session">
            <span>{session.deviceInfo} - {session.location}</span>
            <span>Last active: {new Date(session.lastActivity).toLocaleString()}</span>
            {!session.isCurrentSession && (
              <button onClick={() => revokeSession(session.id)}>
                Revoke
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="api-keys">
        <h2>API Keys</h2>
        <button onClick={() => createApiKey('AutoBolt Key', ['read_directories', 'create_submissions'])}>
          Create New API Key
        </button>
        
        {apiKeys.map(key => (
          <div key={key.id} className="api-key">
            <span>{key.name} ({key.keyPrefix})</span>
            <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
            <span>Permissions: {key.permissions.join(', ')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
`

/**
 * Example 7: Middleware Chain for Complex Authentication
 * Shows how to chain multiple middleware functions
 */
export async function complexAuthRouteExample(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Chain multiple middleware functions
  const middlewareChain = [
    // Security headers first
    require('./middleware').securityHeaders(),
    
    // CSRF protection for state-changing operations
    req.method !== 'GET' ? require('./middleware').csrfProtection() : null,
    
    // Rate limiting
    authMiddleware({ rateLimitTier: 'strict' }),
    
    // Authentication with specific requirements
    authMiddleware({
      requireAuth: true,
      requireVerified: true,
      allowedRoles: ['customer', 'admin'],
      requiredPermission: 'submissions:create'
    })
  ].filter(Boolean) // Remove null middleware

  // Execute middleware chain
  let currentIndex = 0
  const executeNext = async () => {
    if (currentIndex >= middlewareChain.length) {
      // All middleware passed, execute main handler
      const authenticatedReq = req as AuthenticatedRequest
      
      res.json({
        message: 'Complex authentication passed!',
        user: authenticatedReq.user!.email,
        role: authenticatedReq.role,
        permissions: 'submissions:create verified'
      })
      return
    }
    
    const middleware = middlewareChain[currentIndex++]
    await middleware(req, res, executeNext)
  }
  
  await executeNext()
}

/**
 * Example 8: AutoBolt Extension Integration
 * Complete example for AutoBolt Chrome extension
 */
export const autoBoltExtensionExample = `
// AutoBolt Chrome Extension - content script
class AutoBoltIntegration {
  constructor() {
    this.apiKey = this.getStoredApiKey()
    this.baseUrl = 'https://your-domain.com/api'
  }

  async authenticateWithDirectoryBolt() {
    if (!this.apiKey) {
      throw new Error('API key not found. Please configure in extension settings.')
    }

    // Validate API key
    const response = await fetch(this.baseUrl + '/auth/validate-key', {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        'User-Agent': 'AutoBolt Extension v1.0'
      }
    })

    if (!response.ok) {
      throw new Error('API key validation failed')
    }

    const data = await response.json()
    return data.data
  }

  async submitToDirectories(businessData, selectedDirectories) {
    try {
      const userInfo = await this.authenticateWithDirectoryBolt()
      
      // Check user's submission limits
      if (userInfo.directories_used_this_period >= userInfo.directory_limit) {
        throw new Error('Directory submission limit reached for your tier')
      }

      // Submit to each selected directory
      const results = []
      for (const directoryId of selectedDirectories) {
        const result = await this.submitToSingleDirectory(businessData, directoryId)
        results.push(result)
      }

      return results
    } catch (error) {
      console.error('AutoBolt submission failed:', error)
      throw error
    }
  }

  async submitToSingleDirectory(businessData, directoryId) {
    const response = await fetch(this.baseUrl + '/autobolt/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'User-Agent': 'AutoBolt Extension v1.0'
      },
      body: JSON.stringify({
        directoryId,
        businessData: {
          name: businessData.businessName,
          url: businessData.website,
          email: businessData.email,
          description: businessData.description,
          category: businessData.category
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error.message || 'Submission failed')
    }

    return await response.json()
  }

  getStoredApiKey() {
    return localStorage.getItem('directoryBolt_apiKey') || 
           chrome?.storage?.sync?.get(['apiKey'])?.apiKey
  }
}

// Usage in extension
const autoBolt = new AutoBoltIntegration()
autoBolt.submitToDirectories(businessData, selectedDirectories)
  .then(results => console.log('Submissions completed:', results))
  .catch(error => console.error('Submission error:', error))
`

/**
 * Example 9: Enhanced Login API with Session Creation
 * Shows updated login endpoint using new auth system
 */
export const enhancedLoginApiExample = `
// pages/api/auth/enhanced-login.ts
import { jwtManager } from '../../../lib/auth/jwt'
import { sessionManager } from '../../../lib/auth/session-manager'
import { getUserRole } from '../../../lib/auth/rbac'
import bcrypt from 'bcryptjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, password, rememberMe } = req.body
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  const userAgent = req.headers['user-agent']

  try {
    // Find and validate user
    const user = await findUserByEmail(email)
    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Create session
    const session = await sessionManager.createSession(user, {
      userAgent,
      ip: clientIp
    }, {
      rememberMe,
      loginMethod: 'password'
    })

    // Generate tokens
    const role = getUserRole(user)
    const accessToken = jwtManager.generateAccessToken(user, session.id)
    const refreshResult = await jwtManager.generateRefreshToken(user, userAgent, clientIp)

    // Set secure cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    }

    res.setHeader('Set-Cookie', [
      \`access_token=\${accessToken}; \${Object.entries({
        ...cookieOptions,
        maxAge: 15 * 60 * 1000
      }).map(([k, v]) => \`\${k}=\${v}\`).join('; ')}\`,
      \`refresh_token=\${refreshResult.token}; \${Object.entries({
        ...cookieOptions,
        maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
      }).map(([k, v]) => \`\${k}=\${v}\`).join('; ')}\`
    ])

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role,
          subscription_tier: user.subscription_tier
        },
        session: {
          id: session.id,
          expiresAt: new Date(Date.now() + session.timeoutMs).toISOString()
        }
      }
    })
  } catch (error) {
    console.error('Enhanced login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
}
`