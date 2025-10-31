// 🎯 ONE-TIME TIER MANAGEMENT SYSTEM
// Manages permanent tier access for DirectoryBolt one-time purchases
// REPLACES: subscription-based tier management with permanent access model

import type { 
  User, 
  OneTimePurchase, 
  TierAccess,
  TIER_FEATURES 
} from '../database/one-time-purchase-schema'
import { 
  canAccessFeature, 
  getDirectoryLimit 
} from '../database/one-time-purchase-schema'

export type TierLevel = 'free' | 'starter' | 'growth' | 'professional' | 'enterprise'

export class OneTimeTierManager {
  
  /**
   * Get user's current tier access based on one-time purchases
   * This replaces subscription status checking
   */
  async getUserTierAccess(userEmail: string): Promise<TierAccess> {
    try {
      // TODO: Implement database query to get user's current tier
      // const user = await db.users.findFirst({ 
      //   where: { email: userEmail },
      //   include: { one_time_purchases: true }
      // })
      
      // Mock implementation for now
      const mockUser = await this.getMockUser(userEmail)
      
      if (!mockUser) {
        return this.getFreeTierAccess()
      }
      
      // If user has permanent tier access from one-time purchase
      if (mockUser.tier_access_type === 'permanent' && mockUser.current_tier !== 'free') {
        return {
          tier: mockUser.current_tier,
          access_type: 'permanent',
          purchased_at: mockUser.tier_purchased_at,
          directory_limit: getDirectoryLimit(mockUser.current_tier),
          directories_used: mockUser.directories_used_this_period,
          can_access_feature: (feature: string) => canAccessFeature(mockUser.current_tier, feature)
        }
      }
      
      // Default to free tier
      return this.getFreeTierAccess()
      
    } catch (error) {
      console.error('Error getting user tier access:', error)
      return this.getFreeTierAccess()
    }
  }
  
  /**
   * Check if user has access to a specific tier level
   * Used for feature gating and access control
   */
  async hasAccessToTier(userEmail: string, requiredTier: TierLevel): Promise<boolean> {
    const userAccess = await this.getUserTierAccess(userEmail)
    
    // Tier hierarchy: enterprise > professional > growth > starter > free
    const tierHierarchy = {
      'free': 0,
      'starter': 1,
      'growth': 2,
      'professional': 3,
      'enterprise': 4
    }
    
    const userTierLevel = tierHierarchy[userAccess.tier] || 0
    const requiredTierLevel = tierHierarchy[requiredTier] || 0
    
    return userTierLevel >= requiredTierLevel
  }
  
  /**
   * Check if user has access to a specific feature
   */
  async canAccessFeature(userEmail: string, feature: string): Promise<boolean> {
    const userAccess = await this.getUserTierAccess(userEmail)
    return userAccess.can_access_feature(feature)
  }
  
  /**
   * Grant permanent tier access after successful one-time payment
   * This is called from the webhook handler when payment succeeds
   */
  async grantPermanentTierAccess(
    userEmail: string, 
    tier: TierLevel, 
    purchaseId: string,
    directoryCount?: number
  ): Promise<void> {
    console.log(`Granting permanent ${tier} tier access to ${userEmail}`)
    
    try {
      // TODO: Implement database update
      // await db.users.update({
      //   where: { email: userEmail },
      //   data: {
      //     current_tier: tier,
      //     tier_access_type: 'permanent',
      //     tier_purchased_at: new Date(),
      //     purchased_package_id: purchaseId,
      //     directory_limit: getDirectoryLimit(tier),
      //     directories_used_this_period: 0, // Reset on new purchase
      //     directory_count_reset_at: new Date(),
      //     updated_at: new Date()
      //   }
      // })
      
      console.log(`✅ Permanent ${tier} tier access granted to ${userEmail}`)
      
      // Log tier upgrade for analytics
      await this.logTierUpgrade(userEmail, 'free', tier, 'one_time_purchase', purchaseId)
      
    } catch (error) {
      console.error(`Failed to grant tier access to ${userEmail}:`, error)
      throw new Error(`Failed to grant ${tier} tier access`)
    }
  }
  
  /**
   * Check directory usage limits for current tier
   */
  async checkDirectoryUsageLimit(userEmail: string): Promise<{
    canSubmit: boolean
    currentUsage: number
    limit: number
    tier: TierLevel
  }> {
    const userAccess = await this.getUserTierAccess(userEmail)
    
    return {
      canSubmit: userAccess.directories_used < userAccess.directory_limit,
      currentUsage: userAccess.directories_used,
      limit: userAccess.directory_limit,
      tier: userAccess.tier
    }
  }
  
  /**
   * Increment directory usage count
   */
  async incrementDirectoryUsage(userEmail: string, count: number = 1): Promise<void> {
    console.log(`Incrementing directory usage for ${userEmail} by ${count}`)
    
    // TODO: Implement database update
    // await db.users.update({
    //   where: { email: userEmail },
    //   data: {
    //     directories_used_this_period: {
    //       increment: count
    //     },
    //     updated_at: new Date()
    //   }
    // })
  }
  
  /**
   * Reset directory usage count (called after new purchase)
   */
  async resetDirectoryUsage(userEmail: string): Promise<void> {
    console.log(`Resetting directory usage for ${userEmail}`)
    
    // TODO: Implement database update
    // await db.users.update({
    //   where: { email: userEmail },
    //   data: {
    //     directories_used_this_period: 0,
    //     directory_count_reset_at: new Date(),
    //     updated_at: new Date()
    //   }
    // })
  }
  
  /**
   * Get upgrade options for current user
   */
  async getUpgradeOptions(userEmail: string): Promise<{
    currentTier: TierLevel
    upgradeOptions: Array<{
      tier: TierLevel
      name: string
      price: number
      features: string[]
      directoryLimit: number
    }>
  }> {
    const userAccess = await this.getUserTierAccess(userEmail)
    
    const allTiers = [
      { 
        tier: 'starter' as TierLevel, 
        name: 'Starter', 
        price: 14900,
        features: ['25 AI-optimized submissions', 'Basic AI analysis', 'Email support'],
        directoryLimit: 25
      },
      { 
        tier: 'growth' as TierLevel, 
        name: 'Growth', 
        price: 29900,
        features: ['75 AI-optimized submissions', 'Advanced AI research', 'Priority support'],
        directoryLimit: 75
      },
      { 
        tier: 'professional' as TierLevel, 
        name: 'Professional', 
        price: 49900,
        features: ['150 submissions', 'Custom AI research', 'Phone support', 'API access'],
        directoryLimit: 150
      },
      { 
        tier: 'enterprise' as TierLevel, 
        name: 'Enterprise', 
        price: 79900,
        features: ['500+ submissions', 'Dedicated AI analyst', 'Full AI suite'],
        directoryLimit: 500
      }
    ]
    
    // Get tier hierarchy position
    const tierHierarchy = {
      'free': 0,
      'starter': 1,
      'growth': 2,
      'professional': 3,
      'enterprise': 4
    }
    
    const currentTierLevel = tierHierarchy[userAccess.tier] || 0
    
    // Only show upgrade options (higher tiers)
    const upgradeOptions = allTiers.filter(tier => 
      (tierHierarchy[tier.tier] || 0) > currentTierLevel
    )
    
    return {
      currentTier: userAccess.tier,
      upgradeOptions
    }
  }
  
  /**
   * Validate tier access middleware for API routes
   */
  async validateTierAccess(userEmail: string, requiredTier: TierLevel): Promise<{
    hasAccess: boolean
    currentTier: TierLevel
    message?: string
  }> {
    const hasAccess = await this.hasAccessToTier(userEmail, requiredTier)
    const userAccess = await this.getUserTierAccess(userEmail)
    
    if (!hasAccess) {
      return {
        hasAccess: false,
        currentTier: userAccess.tier,
        message: `${requiredTier} tier access required. Current tier: ${userAccess.tier}`
      }
    }
    
    return {
      hasAccess: true,
      currentTier: userAccess.tier
    }
  }
  
  /**
   * Get user's purchase history for one-time payments
   */
  async getPurchaseHistory(userEmail: string): Promise<OneTimePurchase[]> {
    // TODO: Implement database query
    // return await db.one_time_purchases.findMany({
    //   where: { customer_email: userEmail },
    //   orderBy: { purchased_at: 'desc' }
    // })
    
    return [] // Mock empty array for now
  }
  
  // Private helper methods
  
  private getFreeTierAccess(): TierAccess {
    return {
      tier: 'free',
      access_type: 'free',
      directory_limit: 5,
      directories_used: 0,
      can_access_feature: (feature: string) => canAccessFeature('free', feature)
    }
  }
  
  private async getMockUser(email: string): Promise<User | null> {
    // Mock user data for development
    if (email === 'test@directorybolt.com') {
      return {
        id: 'user_123',
        email: email,
        password_hash: 'hashed',
        current_tier: 'growth',
        tier_access_type: 'permanent',
        tier_purchased_at: new Date('2024-01-01'),
        directory_limit: 75,
        directories_used_this_period: 10,
        stripe_customer_id: 'cus_test123',
        is_verified: true,
        failed_login_attempts: 0,
        credits_remaining: 0,
        created_at: new Date('2024-01-01'),
        updated_at: new Date()
      } as User
    }
    
    return null
  }
  
  private async logTierUpgrade(
    userEmail: string,
    fromTier: TierLevel,
    toTier: TierLevel,
    source: string,
    purchaseId?: string
  ): Promise<void> {
    console.log(`Tier upgrade logged: ${userEmail} from ${fromTier} to ${toTier} via ${source}`)
    
    // TODO: Implement analytics logging
    // await db.tier_upgrades.create({
    //   data: {
    //     user_email: userEmail,
    //     from_tier: fromTier,
    //     to_tier: toTier,
    //     source: source,
    //     purchase_id: purchaseId,
    //     created_at: new Date()
    //   }
    // })
  }
}

// Singleton instance
export const oneTimeTierManager = new OneTimeTierManager()

// Export commonly used functions
export const {
  getUserTierAccess,
  hasAccessToTier,
  canAccessFeature: checkFeatureAccess,
  grantPermanentTierAccess,
  checkDirectoryUsageLimit,
  validateTierAccess,
  getUpgradeOptions
} = oneTimeTierManager

export default oneTimeTierManager
