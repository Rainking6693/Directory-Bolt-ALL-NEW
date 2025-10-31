// 🏆 USER TIER STATUS API - Check user's permanent tier access from one-time purchases
// GET /api/user/tier-status - Retrieve permanent tier access and usage limits
// REPLACES: /api/subscription-status (now deprecated)

import type { NextApiRequest, NextApiResponse } from 'next'
import { handleApiError } from '../../../lib/utils/errors'
import { oneTimeTierManager } from '../../../lib/services/one-time-tier-manager'
import type { TierLevel } from '../../../lib/services/one-time-tier-manager'

interface TierStatusRequest extends NextApiRequest {
  query: {
    user_email?: string
    user_id?: string
  }
}

interface TierStatusResponse {
  success: true
  data: {
    user_email: string
    tier_access: {
      tier: TierLevel
      access_type: 'free' | 'permanent'
      purchased_at?: string
      directory_limit: number
      directories_used: number
      directories_remaining: number
      usage_percentage: number
    }
    features_available: string[]
    ai_features_available: string[]
    directory_usage: {
      can_submit: boolean
      usage_warning?: string
    }
    purchase_history: Array<{
      package_id: string
      tier_access: string
      purchased_at: string
      amount_paid: number
      currency: string
    }>
    upgrade_options?: Array<{
      tier: TierLevel
      name: string
      price: number
      features: string[]
      directory_limit: number
    }>
    notifications: Array<{
      type: 'info' | 'warning' | 'success'
      title: string
      message: string
      action?: string
    }>
  }
  requestId: string
}

export default async function handler(
  req: TierStatusRequest,
  res: NextApiResponse<TierStatusResponse | any>
) {
  const requestId = `tier_status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET'])
      return res.status(405).json(handleApiError(
        new Error('Method not allowed'),
        requestId
      ))
    }
    
    await handleGetTierStatus(req, res, requestId)
    
  } catch (error) {
    console.error('Tier status error:', error)
    const errorResponse = handleApiError(error as Error, requestId)
    return res.status(errorResponse.error.statusCode || 500).json(errorResponse)
  }
}

async function handleGetTierStatus(
  req: TierStatusRequest,
  res: NextApiResponse,
  requestId: string
) {
  const { user_email, user_id } = req.query
  
  // Validate required parameters  
  if (!user_email && !user_id) {
    throw new Error('User email or ID is required')
  }
  
  // TODO: Convert user_id to email if needed
  const userEmail = user_email || await getUserEmailById(user_id!)
  
  if (!userEmail) {
    throw new Error('User not found')
  }
  
  try {
    // Get user's current tier access
    const tierAccess = await oneTimeTierManager.getUserTierAccess(userEmail)
    
    // Get directory usage limits
    const directoryUsage = await oneTimeTierManager.checkDirectoryUsageLimit(userEmail)
    
    // Get purchase history  
    const purchaseHistory = await oneTimeTierManager.getPurchaseHistory(userEmail)
    
    // Get upgrade options
    const upgradeOptions = await oneTimeTierManager.getUpgradeOptions(userEmail)
    
    // Get available features for current tier
    const { features_available, ai_features_available } = getAvailableFeatures(tierAccess.tier)
    
    // Generate notifications
    const notifications = generateTierNotifications(tierAccess, directoryUsage)
    
    const tierStatusData = {
      user_email: userEmail,
      tier_access: {
        tier: tierAccess.tier,
        access_type: tierAccess.access_type,
        purchased_at: tierAccess.purchased_at?.toISOString(),
        directory_limit: tierAccess.directory_limit,
        directories_used: tierAccess.directories_used,
        directories_remaining: Math.max(0, tierAccess.directory_limit - tierAccess.directories_used),
        usage_percentage: Math.round((tierAccess.directories_used / tierAccess.directory_limit) * 100)
      },
      features_available,
      ai_features_available,
      directory_usage: {
        can_submit: directoryUsage.canSubmit,
        usage_warning: directoryUsage.currentUsage >= directoryUsage.limit * 0.9 
          ? 'Approaching directory limit' 
          : undefined
      },
      purchase_history: purchaseHistory.map(purchase => ({
        package_id: purchase.package_id,
        tier_access: purchase.tier_access,
        purchased_at: purchase.purchased_at.toISOString(),
        amount_paid: purchase.amount_paid,
        currency: purchase.currency
      })),
      upgrade_options: upgradeOptions.upgradeOptions.map(option => ({
        ...option,
        directory_limit: option.directoryLimit
      })),
      notifications
    }
    
    console.log(`✅ Tier status retrieved:`, {
      user_email: userEmail,
      tier: tierAccess.tier,
      access_type: tierAccess.access_type,
      directory_usage: `${directoryUsage.currentUsage}/${directoryUsage.limit}`,
      can_submit: directoryUsage.canSubmit,
      request_id: requestId
    })
    
    const response: TierStatusResponse = {
      success: true,
      data: tierStatusData,
      requestId
    }
    
    res.status(200).json(response)
    
  } catch (error) {
    console.error('Error getting tier status:', error)
    throw new Error(`Failed to retrieve tier status: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Helper function to get available features for a tier
function getAvailableFeatures(tier: TierLevel): {
  features_available: string[]
  ai_features_available: string[]
} {
  const tierFeatures = {
    free: {
      features: ['Basic directory access', 'Manual submissions only'],
      ai_features: []
    },
    starter: {
      features: [
        '25 AI-optimized directory submissions',
        'Basic AI competitive analysis', 
        'AI-powered business profile optimization',
        'Email support',
        '30-day completion guarantee',
        'AI insights dashboard'
      ],
      ai_features: [
        'Basic AI business analysis',
        'AI-optimized directory matching',
        'Automated competitive positioning',
        'AI-generated business insights'
      ]
    },
    growth: {
      features: [
        '75 AI-optimized directory submissions',
        'Comprehensive AI competitive analysis',
        'AI market research & insights',
        'Priority processing & support', 
        'AI-powered revenue projections',
        'Advanced analytics dashboard',
        'AI business strategy recommendations'
      ],
      ai_features: [
        'Advanced AI competitive analysis',
        'AI-powered market research',
        'Intelligent directory prioritization', 
        'AI business strategy recommendations',
        'Automated revenue projections'
      ]
    },
    professional: {
      features: [
        '150 AI-optimized directory submissions',
        'Custom AI market research reports',
        'White-label AI business intelligence',
        'Phone & priority support',
        'AI competitor intelligence tracking',
        'Custom AI business modeling',
        'API access for integrations',
        'Quarterly AI strategy sessions'
      ],
      ai_features: [
        'Custom AI market research',
        'White-label AI reports',
        'AI competitor intelligence tracking',
        'Custom AI business modeling',
        'AI-powered growth strategy development'
      ]
    },
    enterprise: {
      features: [
        '500+ AI-optimized directory submissions',
        'Dedicated AI business analyst',
        'Full AI intelligence suite',
        'Dedicated account management',
        'Custom AI business modeling',
        'Quarterly AI strategy sessions',
        'White-label AI reports',
        'API access & custom integrations',
        'Real-time AI market monitoring'
      ],
      ai_features: [
        'Full AI intelligence suite',
        'Dedicated AI analyst',
        'Custom AI business modeling',
        'AI-powered market expansion planning',
        'Real-time AI competitive monitoring'
      ]
    }
  }
  
  const features = tierFeatures[tier] || tierFeatures.free
  return {
    features_available: features.features,
    ai_features_available: features.ai_features
  }
}

// Generate notifications based on tier status
function generateTierNotifications(
  tierAccess: any,
  directoryUsage: any
): Array<{
  type: 'info' | 'warning' | 'success'
  title: string
  message: string
  action?: string
}> {
  const notifications = []
  
  // Welcome message for new permanent tier access
  if (tierAccess.access_type === 'permanent' && tierAccess.tier !== 'free') {
    notifications.push({
      type: 'success' as const,
      title: 'Permanent Tier Access Active',
      message: `You have permanent access to ${tierAccess.tier} tier features. No recurring fees!`,
    })
  }
  
  // Directory usage warnings
  const usagePercentage = Math.round((directoryUsage.currentUsage / directoryUsage.limit) * 100)
  
  if (usagePercentage >= 90) {
    notifications.push({
      type: 'warning' as const,
      title: 'Directory Limit Almost Reached',
      message: `You've used ${usagePercentage}% of your directory submissions (${directoryUsage.currentUsage}/${directoryUsage.limit}).`,
      action: 'upgrade'
    })
  } else if (usagePercentage >= 75) {
    notifications.push({
      type: 'info' as const,
      title: 'High Directory Usage',
      message: `You've used ${usagePercentage}% of your directory submissions.`,
      action: 'monitor'
    })
  }
  
  // Free tier upgrade suggestion
  if (tierAccess.tier === 'free') {
    notifications.push({
      type: 'info' as const,
      title: 'Upgrade Available',
      message: 'Unlock AI-powered features and higher directory limits with a one-time purchase.',
      action: 'upgrade'
    })
  }
  
  return notifications
}

// Helper function to convert user ID to email (TODO: implement with database)
async function getUserEmailById(userId: string): Promise<string | null> {
  // TODO: Implement database query
  // const user = await db.users.findFirst({ where: { id: userId } })
  // return user?.email || null
  
  // Mock implementation for development
  if (userId === 'user_test_123') {
    return 'test@directorybolt.com'
  }
  
  return null
}