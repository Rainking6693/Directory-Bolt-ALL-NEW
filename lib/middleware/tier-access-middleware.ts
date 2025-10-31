// 🔐 TIER ACCESS MIDDLEWARE - ONE-TIME PURCHASE MODEL
// Middleware for validating permanent tier access after one-time purchases
// REPLACES: subscription-based access validation with permanent access checks

import { NextApiRequest, NextApiResponse } from 'next'
import { oneTimeTierManager } from '../services/one-time-tier-manager'
import type { TierLevel } from '../services/one-time-tier-manager'

export interface AuthenticatedRequest extends NextApiRequest {
  user?: {
    id: string
    email: string
    tier: TierLevel
    hasAccess: (tier: TierLevel) => Promise<boolean>
    canUseFeature: (feature: string) => Promise<boolean>
    directoryUsage: {
      used: number
      limit: number
      canSubmit: boolean
    }
  }
}

/**
 * Middleware to validate permanent tier access for API routes
 * Usage: requireTierAccess('growth') - requires Growth tier or higher
 */
export function requireTierAccess(requiredTier: TierLevel) {
  return async (
    req: AuthenticatedRequest,
    res: NextApiResponse,
    next?: () => void
  ) => {
    try {
      // Get user email from session/auth (TODO: integrate with your auth system)
      const userEmail = getUserEmailFromRequest(req)
      
      if (!userEmail) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
          message: 'Please log in to access this feature'
        })
      }
      
      // Check if user has required tier access
      const accessValidation = await oneTimeTierManager.validateTierAccess(userEmail, requiredTier)
      
      if (!accessValidation.hasAccess) {
        return res.status(403).json({
          error: 'Insufficient tier access',
          code: 'TIER_ACCESS_REQUIRED',
          message: accessValidation.message,
          currentTier: accessValidation.currentTier,
          requiredTier: requiredTier,
          upgradeUrl: '/pricing'
        })
      }
      
      // Get user's current tier access details
      const userAccess = await oneTimeTierManager.getUserTierAccess(userEmail)
      const directoryUsage = await oneTimeTierManager.checkDirectoryUsageLimit(userEmail)
      
      // Attach user info to request
      req.user = {
        id: 'user_' + userEmail.split('@')[0], // TODO: Get actual user ID
        email: userEmail,
        tier: userAccess.tier,
        hasAccess: async (tier: TierLevel) => await oneTimeTierManager.hasAccessToTier(userEmail, tier),
        canUseFeature: async (feature: string) => await oneTimeTierManager.canAccessFeature(userEmail, feature),
        directoryUsage: {
          used: directoryUsage.currentUsage,
          limit: directoryUsage.limit,
          canSubmit: directoryUsage.canSubmit
        }
      }
      
      // Continue to next middleware or route handler
      if (next) {
        next()
      }
      
    } catch (error) {
      console.error('Tier access middleware error:', error)
      return res.status(500).json({
        error: 'Access validation failed',
        code: 'VALIDATION_ERROR',
        message: 'Unable to validate tier access'
      })
    }
  }
}

/**
 * Middleware to check directory submission limits
 * Prevents users from exceeding their tier's directory limit
 */
export function checkDirectoryLimit() {
  return async (
    req: AuthenticatedRequest,
    res: NextApiResponse,
    next?: () => void
  ) => {
    try {
      const userEmail = getUserEmailFromRequest(req)
      
      if (!userEmail) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        })
      }
      
      const usageCheck = await oneTimeTierManager.checkDirectoryUsageLimit(userEmail)
      
      if (!usageCheck.canSubmit) {
        const upgradeOptions = await oneTimeTierManager.getUpgradeOptions(userEmail)
        
        return res.status(403).json({
          error: 'Directory limit exceeded',
          code: 'DIRECTORY_LIMIT_EXCEEDED',
          message: `You have reached your ${usageCheck.tier} tier limit of ${usageCheck.limit} directories`,
          currentUsage: usageCheck.currentUsage,
          limit: usageCheck.limit,
          tier: usageCheck.tier,
          upgradeOptions: upgradeOptions.upgradeOptions,
          upgradeUrl: '/pricing'
        })
      }
      
      // Continue to next middleware or route handler
      if (next) {
        next()
      }
      
    } catch (error) {
      console.error('Directory limit middleware error:', error)
      return res.status(500).json({
        error: 'Limit check failed',
        code: 'LIMIT_CHECK_ERROR'
      })
    }
  }
}

/**
 * Middleware to validate specific feature access
 * Usage: requireFeatureAccess('ai_research') - requires access to AI research feature
 */
export function requireFeatureAccess(feature: string) {
  return async (
    req: AuthenticatedRequest,
    res: NextApiResponse,
    next?: () => void
  ) => {
    try {
      const userEmail = getUserEmailFromRequest(req)
      
      if (!userEmail) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        })
      }
      
      const hasAccess = await oneTimeTierManager.canAccessFeature(userEmail, feature)
      
      if (!hasAccess) {
        const userAccess = await oneTimeTierManager.getUserTierAccess(userEmail)
        const upgradeOptions = await oneTimeTierManager.getUpgradeOptions(userEmail)
        
        return res.status(403).json({
          error: 'Feature access required',
          code: 'FEATURE_ACCESS_REQUIRED',
          message: `The ${feature} feature requires a higher tier`,
          currentTier: userAccess.tier,
          feature: feature,
          upgradeOptions: upgradeOptions.upgradeOptions,
          upgradeUrl: '/pricing'
        })
      }
      
      // Continue to next middleware or route handler
      if (next) {
        next()
      }
      
    } catch (error) {
      console.error('Feature access middleware error:', error)
      return res.status(500).json({
        error: 'Feature access validation failed',
        code: 'FEATURE_VALIDATION_ERROR'
      })
    }
  }
}

/**
 * Middleware to track directory usage (call after successful directory submission)
 */
export function trackDirectoryUsage(count: number = 1) {
  return async (
    req: AuthenticatedRequest,
    res: NextApiResponse,
    next?: () => void
  ) => {
    try {
      const userEmail = getUserEmailFromRequest(req)
      
      if (userEmail) {
        await oneTimeTierManager.incrementDirectoryUsage(userEmail, count)
        console.log(`Directory usage incremented for ${userEmail}: +${count}`)
      }
      
      // Continue to next middleware or route handler
      if (next) {
        next()
      }
      
    } catch (error) {
      console.error('Directory usage tracking error:', error)
      // Don't fail the request for tracking errors
      if (next) {
        next()
      }
    }
  }
}

/**
 * Utility function to get user email from request
 * TODO: Integrate with your authentication system
 */
function getUserEmailFromRequest(req: NextApiRequest): string | null {
  // Option 1: From JWT token
  // const token = req.headers.authorization?.replace('Bearer ', '')
  // if (token) {
  //   const decoded = jwt.verify(token, process.env.JWT_SECRET)
  //   return decoded.email
  // }
  
  // Option 2: From session
  // if (req.session?.user?.email) {
  //   return req.session.user.email
  // }
  
  // Option 3: From custom header (for testing)
  const testEmail = req.headers['x-user-email'] as string
  if (testEmail) {
    return testEmail
  }
  
  // Option 4: From query parameter (for development only)
  if (process.env.NODE_ENV === 'development' && req.query.user_email) {
    return req.query.user_email as string
  }
  
  return null
}

/**
 * Helper function to create API route with tier access validation
 * Usage: 
 * export default withTierAccess('growth', async (req, res) => {
 *   // Handler code with guaranteed Growth+ tier access
 * })
 */
export function withTierAccess(
  requiredTier: TierLevel,
  handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void> | void
) {
  return async (req: AuthenticatedRequest, res: NextApiResponse) => {
    const middleware = requireTierAccess(requiredTier)
    
    await new Promise<void>((resolve, reject) => {
      middleware(req, res, () => {
        resolve()
      })
      
      // Handle middleware responses
      res.on('finish', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Middleware failed with status ${res.statusCode}`))
        }
      })
    }).catch(() => {
      // Middleware already sent response
      return
    })
    
    // If middleware passed, continue to handler
    if (!res.headersSent) {
      await handler(req, res)
    }
  }
}

/**
 * Helper function to create API route with feature access validation
 */
export function withFeatureAccess(
  feature: string,
  handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void> | void
) {
  return async (req: AuthenticatedRequest, res: NextApiResponse) => {
    const middleware = requireFeatureAccess(feature)
    
    await new Promise<void>((resolve, reject) => {
      middleware(req, res, () => {
        resolve()
      })
      
      res.on('finish', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Middleware failed with status ${res.statusCode}`))
        }
      })
    }).catch(() => {
      return
    })
    
    if (!res.headersSent) {
      await handler(req, res)
    }
  }
}

const tierAccessMiddleware = {
  requireTierAccess,
  checkDirectoryLimit,
  requireFeatureAccess,
  trackDirectoryUsage,
  withTierAccess,
  withFeatureAccess
}

export default tierAccessMiddleware
