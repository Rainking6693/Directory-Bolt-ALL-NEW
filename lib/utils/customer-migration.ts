/**
 * Customer Migration Utility for AI-Enhanced Pricing
 * Handles grandfathering existing customers to new AI pricing tiers
 */

const directoryBoltProducts = require('../config/directoryBoltProducts')
const { CORE_PACKAGES, getGrandfatherPricing, calculateBusinessValue } = directoryBoltProducts

export interface MigrationPlan {
  customerId: string
  currentPlan: string
  recommendedPlan: string
  grandfatheredPrice: number
  originalPrice: number
  discountPercentage: number
  validUntil: string
  migrationReason: string
  valueProposition: {
    consultantEquivalent: string
    totalValue: string
    roiMultiple: number
    savingsPercentage: string
  }
}

export interface CustomerProfile {
  id: string
  email: string
  currentPlan: string
  monthlyRevenue?: number
  businessType?: string
  signupDate: string
  lastActive: string
  totalSpent: number
}

/**
 * Analyzes customer profile and recommends optimal AI-enhanced plan
 */
export function analyzeCustomerForMigration(customer: CustomerProfile): MigrationPlan | null {
  // Don't migrate customers who signed up less than 30 days ago
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const signupDate = new Date(customer.signupDate)
  
  if (signupDate > thirtyDaysAgo) {
    return null
  }
  
  // Determine recommended plan based on current usage and profile
  let recommendedPlan = getRecommendedPlan(customer)
  
  // Get grandfathering pricing
  const grandfatherPricing = getGrandfatherPricing(customer.currentPlan, recommendedPlan)
  
  if (!grandfatherPricing) {
    return null
  }
  
  // Calculate value proposition
  const businessValue = calculateBusinessValue(recommendedPlan)
  
  if (!businessValue) {
    return null
  }
  
  return {
    customerId: customer.id,
    currentPlan: customer.currentPlan,
    recommendedPlan: recommendedPlan,
    grandfatheredPrice: grandfatherPricing.grandfathered_price,
    originalPrice: grandfatherPricing.original_price,
    discountPercentage: grandfatherPricing.discount_percentage,
    validUntil: grandfatherPricing.valid_until,
    migrationReason: getMigrationReason(customer, recommendedPlan),
    valueProposition: {
      consultantEquivalent: businessValue.consultant_savings,
      totalValue: businessValue.total_value,
      roiMultiple: businessValue.roi_multiple,
      savingsPercentage: businessValue.savings_percentage
    }
  }
}

/**
 * Determines optimal plan based on customer profile
 */
function getRecommendedPlan(customer: CustomerProfile): string {
  const { currentPlan, monthlyRevenue = 0, businessType, totalSpent } = customer
  
  // High-value customers should be recommended Enterprise
  if (totalSpent > 500 || monthlyRevenue > 50000) {
    return 'enterprise'
  }
  
  // Agency or consulting businesses should get Professional
  if (businessType?.includes('agency') || businessType?.includes('consulting') || monthlyRevenue > 20000) {
    return 'professional'
  }
  
  // Growing businesses should get Growth plan
  if (currentPlan === 'starter' && (monthlyRevenue > 5000 || totalSpent > 200)) {
    return 'growth'
  }
  
  // Legacy Pro users should be migrated to Professional
  if (currentPlan === 'pro') {
    return 'professional'
  }
  
  // Default upgrade path
  switch (currentPlan) {
    case 'starter':
      return 'growth'
    case 'growth':
      return 'professional'
    default:
      return 'growth'
  }
}

/**
 * Generates personalized migration reason
 */
function getMigrationReason(customer: CustomerProfile, recommendedPlan: string): string {
  const planName = CORE_PACKAGES[recommendedPlan]?.name || recommendedPlan
  
  if (customer.monthlyRevenue && customer.monthlyRevenue > 20000) {
    return `Based on your monthly revenue of $${customer.monthlyRevenue.toLocaleString()}, ${planName} will provide AI-powered insights to scale your business intelligence needs.`
  }
  
  if (customer.totalSpent > 300) {
    return `As a valued customer who has invested $${customer.totalSpent} with DirectoryBolt, you qualify for our ${planName} with AI-enhanced features at a special grandfathered rate.`
  }
  
  return `The ${planName} includes AI-powered competitive analysis and market research that will provide significant value over manual alternatives.`
}

/**
 * Generates migration email content
 */
export function generateMigrationEmail(migrationPlan: MigrationPlan, customer: CustomerProfile) {
  const { recommendedPlan, grandfatheredPrice, originalPrice, discountPercentage, valueProposition, validUntil } = migrationPlan
  const planDetails = CORE_PACKAGES[recommendedPlan]
  
  const subject = `Exclusive AI Upgrade: Save ${discountPercentage}% on ${planDetails.name} Plan`
  
  const body = `
Hi ${customer.email.split('@')[0]},

Great news! We're upgrading DirectoryBolt with AI-powered business intelligence, and as a valued customer, you're getting exclusive early access with a ${discountPercentage}% discount.

## Your Exclusive Offer

**${planDetails.name} Plan**
- Regular Price: $${(originalPrice / 100).toFixed(0)}/month
- **Your Price: $${(grandfatheredPrice / 100).toFixed(0)}/month** (${discountPercentage}% savings!)
- Valid until: ${new Date(validUntil).toLocaleDateString()}

## What You Get with AI Enhancement

${planDetails.ai_features?.map((feature: string) => `• ${feature}`).join('\n') || ''}

${planDetails.features.map((feature: string) => `• ${feature}`).join('\n')}

## The Value You're Getting

Instead of paying $${valueProposition.consultantEquivalent.replace(/[$,+]/g, '')} for a business consultant, you get:
- **${valueProposition.roiMultiple}x ROI** on your investment
- **${valueProposition.savingsPercentage} savings** compared to manual consulting
- **${valueProposition.totalValue.replace(/[$,+]/g, '')}+ total value** delivered monthly

## Why This Upgrade Makes Sense

${migrationPlan.migrationReason}

## How to Activate Your Discount

1. Click the button below to secure your grandfathered pricing
2. Your current plan will be upgraded automatically
3. Start receiving AI-powered insights immediately

[Activate AI Upgrade - $${(grandfatheredPrice / 100).toFixed(0)}/month]

This exclusive offer expires on ${new Date(validUntil).toLocaleDateString()}. After that, the plan returns to regular pricing at $${(originalPrice / 100).toFixed(0)}/month.

Questions? Reply to this email and I'll personally help you get set up.

Best regards,
The DirectoryBolt Team

P.S. This AI upgrade positions you ahead of competitors still using manual research methods. Don't miss out!
`

  return { subject, body }
}

/**
 * Batch process customer migration analysis
 */
export function batchAnalyzeCustomers(customers: CustomerProfile[]): {
  migrationPlans: MigrationPlan[]
  summary: {
    totalCustomers: number
    eligibleForMigration: number
    totalPotentialRevenue: number
    averageDiscount: number
  }
} {
  const migrationPlans = customers
    .map(analyzeCustomerForMigration)
    .filter(Boolean) as MigrationPlan[]
  
  const totalPotentialRevenue = migrationPlans.reduce(
    (sum, plan) => sum + plan.grandfatheredPrice, 0
  )
  
  const averageDiscount = migrationPlans.reduce(
    (sum, plan) => sum + plan.discountPercentage, 0
  ) / migrationPlans.length || 0
  
  return {
    migrationPlans,
    summary: {
      totalCustomers: customers.length,
      eligibleForMigration: migrationPlans.length,
      totalPotentialRevenue,
      averageDiscount: Math.round(averageDiscount)
    }
  }
}

/**
 * Export customer migration data for email campaigns
 */
export function exportMigrationData(migrationPlans: MigrationPlan[]) {
  return migrationPlans.map(plan => ({
    customer_id: plan.customerId,
    current_plan: plan.currentPlan,
    recommended_plan: plan.recommendedPlan,
    grandfathered_price_cents: plan.grandfatheredPrice,
    original_price_cents: plan.originalPrice,
    discount_percentage: plan.discountPercentage,
    valid_until: plan.validUntil,
    roi_multiple: plan.valueProposition.roiMultiple,
    total_value: plan.valueProposition.totalValue,
    migration_reason: plan.migrationReason
  }))
}