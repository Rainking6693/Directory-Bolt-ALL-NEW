// 📊 ONE-TIME PURCHASE DATABASE SCHEMA
// Updated database schema for DirectoryBolt one-time payment model
// REPLACES: subscription-based schema with permanent tier access model

export interface OneTimePurchase {
  id: string
  customer_email: string
  stripe_payment_intent_id: string
  stripe_customer_id?: string
  stripe_checkout_session_id?: string
  
  // Package details
  package_id: 'starter' | 'growth' | 'professional' | 'enterprise'
  package_name: string
  tier_access: 'starter' | 'growth' | 'professional' | 'enterprise'
  directory_count: number
  
  // Add-ons
  addon_ids: string[] // Array of addon IDs purchased
  addon_details?: AddonPurchase[]
  
  // Payment details
  amount_paid: number // Amount in cents
  currency: string
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded'
  
  // Timestamps
  purchased_at: Date
  completed_at?: Date
  refunded_at?: Date
  created_at: Date
  updated_at: Date
  
  // Metadata
  metadata?: Record<string, any>
  notes?: string
}

export interface AddonPurchase {
  addon_id: string
  addon_name: string
  price: number
  description: string
}

// Updated User schema for one-time purchase model
export interface User {
  id: string
  email: string
  password_hash: string
  full_name?: string
  company_name?: string
  
  // ONE-TIME PURCHASE TIER SYSTEM (replaces subscription)
  current_tier: 'free' | 'starter' | 'growth' | 'professional' | 'enterprise'
  tier_access_type: 'free' | 'permanent' // 'permanent' for paid tiers
  tier_purchased_at?: Date
  purchased_package_id?: string
  
  // Directory usage tracking
  directories_used_this_period: number
  directory_limit: number
  directory_count_reset_at?: Date
  
  // Stripe integration
  stripe_customer_id?: string
  
  // Account status
  is_verified: boolean
  failed_login_attempts: number
  credits_remaining: number // For legacy credit system if needed
  
  // Timestamps
  created_at: Date
  updated_at: Date
  
  // Relationships
  one_time_purchases?: OneTimePurchase[]
  failed_payment_attempts?: FailedPaymentAttempt[]
}

// Track failed payment attempts for analytics
export interface FailedPaymentAttempt {
  id: string
  customer_email: string
  stripe_payment_intent_id?: string
  package_id: string
  amount: number
  currency: string
  error_message?: string
  error_code?: string
  attempted_at: Date
  
  // Follow-up tracking
  retry_count: number
  last_retry_at?: Date
  converted_to_success?: boolean
  converted_at?: Date
  
  created_at: Date
  updated_at: Date
}

// Analytics and reporting
export interface PurchaseAnalytics {
  id: string
  date: Date
  package_id: string
  tier: string
  revenue: number // Amount in cents
  customer_email: string
  addon_count: number
  conversion_source?: string
  
  created_at: Date
}

// Migration tracking for users moving from subscription to one-time
export interface SubscriptionMigration {
  id: string
  customer_email: string
  old_subscription_id?: string
  old_tier: string
  new_tier: string
  new_purchase_id: string
  migration_date: Date
  migration_notes?: string
  
  created_at: Date
}

// Tier access validation helper types
export type TierAccess = {
  tier: 'free' | 'starter' | 'growth' | 'professional' | 'enterprise'
  access_type: 'free' | 'permanent'
  purchased_at?: Date
  directory_limit: number
  directories_used: number
  can_access_feature: (feature: string) => boolean
}

// Database operations interface for one-time purchases
export interface OneTimePurchaseRepository {
  // Create new purchase record
  createPurchase(data: Omit<OneTimePurchase, 'id' | 'created_at' | 'updated_at'>): Promise<OneTimePurchase>
  
  // Find purchase by payment intent
  findByPaymentIntent(paymentIntentId: string): Promise<OneTimePurchase | null>
  
  // Find all purchases by customer
  findByCustomerEmail(email: string): Promise<OneTimePurchase[]>
  
  // Update purchase status
  updatePurchaseStatus(id: string, status: OneTimePurchase['payment_status']): Promise<OneTimePurchase>
  
  // Get user's current tier access
  getUserTierAccess(email: string): Promise<TierAccess | null>
  
  // Grant permanent tier access after successful payment
  grantPermanentTierAccess(email: string, tier: string, purchaseId: string): Promise<User>
  
  // Check if user has access to specific tier features
  checkTierAccess(email: string, requiredTier: string): Promise<boolean>
  
  // Reset directory usage count
  resetDirectoryCount(email: string): Promise<void>
  
  // Record failed payment attempt
  recordFailedPayment(data: Omit<FailedPaymentAttempt, 'id' | 'created_at' | 'updated_at'>): Promise<FailedPaymentAttempt>
}

// Tier feature mapping for access control
export const TIER_FEATURES = {
  free: {
    directory_limit: 5,
    features: ['basic_submission'],
    ai_features: []
  },
  starter: {
    directory_limit: 25,
    features: ['basic_submission', 'email_support', 'ai_insights'],
    ai_features: ['basic_ai_analysis', 'ai_matching', 'competitive_positioning']
  },
  growth: {
    directory_limit: 75,
    features: ['priority_processing', 'advanced_analytics', 'ai_research'],
    ai_features: ['advanced_competitive_analysis', 'market_research', 'revenue_projections']
  },
  professional: {
    directory_limit: 150,
    features: ['custom_research', 'phone_support', 'api_access', 'white_label'],
    ai_features: ['custom_market_research', 'competitor_tracking', 'business_modeling']
  },
  enterprise: {
    directory_limit: 500,
    features: ['dedicated_analyst', 'dedicated_support', 'custom_integrations'],
    ai_features: ['full_ai_suite', 'dedicated_ai_analyst', 'real_time_monitoring']
  }
} as const

// Helper function to check feature access
export function canAccessFeature(userTier: string, feature: string): boolean {
  const tierData = TIER_FEATURES[userTier as keyof typeof TIER_FEATURES]
  if (!tierData) return false
  
  return (tierData.features as readonly string[]).includes(feature) || 
         (tierData.ai_features as readonly string[]).includes(feature)
}

// Helper function to get directory limit for tier
export function getDirectoryLimit(tier: string): number {
  const tierData = TIER_FEATURES[tier as keyof typeof TIER_FEATURES]
  return tierData?.directory_limit || 5 // Default to free tier limit
}

const oneTimePurchaseSchema = {
  TIER_FEATURES,
  canAccessFeature,
  getDirectoryLimit
}

export default oneTimePurchaseSchema
