// @ts-nocheck
// Customer Authentication Middleware
// Validates customer authentication and tier access for paid features

import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'

export interface CustomerAuthResult {
  isAuthenticated: boolean
  customer?: {
    id: string
    email: string
    stripeCustomerId: string
    tier: 'free' | 'starter' | 'growth' | 'professional' | 'enterprise'
    subscriptionStatus: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing'
    features: {
      directorySubmissions: number
      seoAnalysis: boolean
      advancedAnalytics: boolean
      prioritySupport: boolean
      whiteLabel: boolean
    }
  }
  error?: string
}

/**
 * Validates customer authentication and returns tier information
 */
export async function validateCustomerAuth(req: NextApiRequest): Promise<CustomerAuthResult> {
  try {
    // Check for JWT token in Authorization header
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
    
    if (!token) {
      // Check for session cookie as fallback
      const sessionToken = req.cookies['customer-session']
      if (!sessionToken) {
        return {
          isAuthenticated: false,
          error: 'No authentication token provided'
        }
      }
      
      return await validateSessionToken(sessionToken)
    }
    
    return await validateJWTToken(token)
    
  } catch (error) {
    console.error('Customer auth validation error:', error)
    return {
      isAuthenticated: false,
      error: 'Authentication validation failed'
    }
  }
}

/**
 * Validates JWT token and extracts customer information
 */
async function validateJWTToken(token: string): Promise<CustomerAuthResult> {
  try {
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured')
    }
    
    const decoded = jwt.verify(token, jwtSecret) as any
    
    if (!decoded.customerId || !decoded.tier) {
      return {
        isAuthenticated: false,
        error: 'Invalid token structure'
      }
    }
    
    // In a real implementation, you would validate against your database
    // For now, we'll construct the customer object from the JWT
    return {
      isAuthenticated: true,
      customer: {
        id: decoded.customerId,
        email: decoded.email,
        stripeCustomerId: decoded.stripeCustomerId,
        tier: decoded.tier,
        subscriptionStatus: decoded.subscriptionStatus || 'active',
        features: getTierFeatures(decoded.tier)
      }
    }
    
  } catch (error) {
    return {
      isAuthenticated: false,
      error: 'Invalid or expired token'
    }
  }
}

/**
 * Validates session token from cookie
 */
async function validateSessionToken(sessionToken: string): Promise<CustomerAuthResult> {
  // In a real implementation, you would look up the session in your database
  // For now, we'll decode if it's a JWT or validate against environment variables
  
  try {
    // Try JWT first
    const jwtSecret = process.env.JWT_SECRET
    if (jwtSecret) {
      const decoded = jwt.verify(sessionToken, jwtSecret) as any
      if (decoded.customerId) {
        return {
          isAuthenticated: true,
          customer: {
            id: decoded.customerId,
            email: decoded.email,
            stripeCustomerId: decoded.stripeCustomerId,
            tier: decoded.tier,
            subscriptionStatus: decoded.subscriptionStatus || 'active',
            features: getTierFeatures(decoded.tier)
          }
        }
      }
    }
    
    // Fallback: Check against test customer tokens (development only)
    if (process.env.NODE_ENV === 'development') {
      const testTokens = {
        'test-professional-token': { tier: 'professional', email: 'test@professional.com' },
        'test-enterprise-token': { tier: 'enterprise', email: 'test@enterprise.com' }
      }
      
      const testCustomer = testTokens[sessionToken as keyof typeof testTokens]
      if (testCustomer) {
        return {
          isAuthenticated: true,
          customer: {
            id: 'test-customer-id',
            email: testCustomer.email,
            stripeCustomerId: 'cus_test123',
            tier: testCustomer.tier as any,
            subscriptionStatus: 'active',
            features: getTierFeatures(testCustomer.tier)
          }
        }
      }
    }
    
    return {
      isAuthenticated: false,
      error: 'Invalid session token'
    }
    
  } catch (error) {
    return {
      isAuthenticated: false,
      error: 'Session validation failed'
    }
  }
}

/**
 * Get tier-specific features
 */
function getTierFeatures(tier: string): CustomerAuthResult['customer']['features'] {
  const tierConfig = {
    free: {
      directorySubmissions: 0,
      seoAnalysis: false,
      advancedAnalytics: false,
      prioritySupport: false,
      whiteLabel: false
    },
    starter: {
      directorySubmissions: 50,
      seoAnalysis: false,
      advancedAnalytics: false,
      prioritySupport: false,
      whiteLabel: false
    },
    growth: {
      directorySubmissions: 150,
      seoAnalysis: false,
      advancedAnalytics: true,
      prioritySupport: false,
      whiteLabel: false
    },
    professional: {
      directorySubmissions: 300,
      seoAnalysis: true,
      advancedAnalytics: true,
      prioritySupport: true,
      whiteLabel: false
    },
    enterprise: {
      directorySubmissions: 500,
      seoAnalysis: true,
      advancedAnalytics: true,
      prioritySupport: true,
      whiteLabel: true
    }
  }
  
  return tierConfig[tier as keyof typeof tierConfig] || tierConfig.free
}

/**
 * Checks if customer has access to a specific feature
 */
export function hasFeatureAccess(
  customer: CustomerAuthResult['customer'],
  feature: keyof CustomerAuthResult['customer']['features']
): boolean {
  if (!customer) return false
  return customer.features[feature] === true
}

/**
 * Middleware wrapper for protecting API endpoints
 */
export function requireCustomerAuth(handler: Function) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const authResult = await validateCustomerAuth(req)
    
    if (!authResult.isAuthenticated) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: authResult.error
      })
    }
    
    // Add customer to request for handler access
    ;(req as any).customer = authResult.customer
    
    return handler(req, res)
  }
}

/**
 * Middleware wrapper for protecting premium features
 */
export function requirePremiumAccess(feature: keyof CustomerAuthResult['customer']['features']) {
  return function(handler: Function) {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      const authResult = await validateCustomerAuth(req)
      
      if (!authResult.isAuthenticated) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: authResult.error
        })
      }
      
      if (!hasFeatureAccess(authResult.customer, feature)) {
        return res.status(403).json({
          success: false,
          error: 'Premium feature access required',
          message: `This feature requires ${feature} access. Please upgrade your plan.`,
          requiredTier: getPremiumTierForFeature(feature)
        })
      }
      
      // Add customer to request for handler access
      ;(req as any).customer = authResult.customer
      
      return handler(req, res)
    }
  }
}

/**
 * Get the minimum tier required for a feature
 */
function getPremiumTierForFeature(feature: keyof CustomerAuthResult['customer']['features']): string {
  const featureTiers = {
    seoAnalysis: 'professional',
    advancedAnalytics: 'growth',
    prioritySupport: 'professional',
    whiteLabel: 'enterprise'
  }
  
  return featureTiers[feature] || 'professional'
}