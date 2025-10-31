// CENTRAL PRICING CONFIGURATION - Single source of truth
// All pricing information should come from this file

export interface PricingTier {
  id: string
  name: string
  price: number // One-time price in dollars
  originalValue: number // Value of services if purchased separately
  description: string
  shortDescription: string
  directories: number
  features: string[]
  highlighted?: boolean
  popular?: boolean
  badge?: string
  support: string
  processing: string
  aiFeatures: string[]
  valueProps: {
    timesSaved: string
    visibilityIncrease: string
    newCustomers: string
    roiPercentage: string
    consultantEquivalent: string
    savings: string
  }
  limits: {
    monthlySubmissions: number
    apiAccess: boolean
    whiteLabel: boolean
    customReports: boolean
    dedicatedSupport: boolean
    seoTools: boolean
    competitorAnalysis: boolean
  }
}

// OFFICIAL PRICING TIERS - One-time purchase model
export const PRICING_TIERS: Record<string, PricingTier> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 149,
    originalValue: 2000,
    description: 'AI-powered directory analysis for small businesses',
    shortDescription: 'Perfect for small businesses starting their online presence',
    directories: 25,
    support: 'Email support (48hr response)',
    processing: '5-7 business days',
    highlighted: false,
    popular: false,
    features: [
      '25 AI-optimized directory submissions',
      'Basic AI competitive analysis',
      'AI business insights dashboard', 
      'Profile optimization recommendations',
      '30-day completion guarantee',
      'Email support',
      'Basic analytics reporting'
    ],
    aiFeatures: [
      'AI business category detection',
      'Basic competitive positioning',
      'Automated profile optimization',
      'SEO score analysis'
    ],
    valueProps: {
      timesSaved: '40+ hours of manual research',
      visibilityIncrease: 'Up to 300% increase in online visibility',
      newCustomers: '2-5 new customers per month',
      roiPercentage: '13x ROI (92% savings)',
      consultantEquivalent: '$2,000+ business consultant package',
      savings: '92% vs hiring consultant'
    },
    limits: {
      monthlySubmissions: 25,
      apiAccess: false,
      whiteLabel: false,
      customReports: false,
      dedicatedSupport: false,
      seoTools: false,
      competitorAnalysis: false
    }
  },

  growth: {
    id: 'growth',
    name: 'Growth',
    price: 299,
    originalValue: 4000,
    description: 'Comprehensive AI business intelligence for growing companies',
    shortDescription: 'Most popular choice for serious business growth',
    directories: 75,
    support: 'Priority support (24hr response)',
    processing: '3-5 business days',
    highlighted: true,
    popular: true,
    badge: 'MOST POPULAR',
    features: [
      '75 AI-optimized directory submissions',
      'Advanced AI competitive analysis',
      'AI market research & insights',
      'Revenue growth projections',
      'Business strategy recommendations',
      'Advanced analytics dashboard',
      'Priority email support',
      'Automated submission tracking'
    ],
    aiFeatures: [
      'Advanced competitor intelligence',
      'Market opportunity analysis',
      'Revenue projection modeling',
      'Growth strategy recommendations',
      'SEO gap analysis'
    ],
    valueProps: {
      timesSaved: '80+ hours of business research',
      visibilityIncrease: 'Up to 500% increase in online visibility',
      newCustomers: '5-12 new customers per month',
      roiPercentage: '13x ROI (92% savings)',
      consultantEquivalent: '$4,000+ consulting package',
      savings: '92% vs hiring consultant'
    },
    limits: {
      monthlySubmissions: 75,
      apiAccess: false,
      whiteLabel: false,
      customReports: true,
      dedicatedSupport: false,
      seoTools: true,
      competitorAnalysis: true
    }
  },

  professional: {
    id: 'professional',
    name: 'Professional',
    price: 499,
    originalValue: 6000,
    description: 'Enterprise-grade AI with advanced SEO and competitor tools',
    shortDescription: 'Complete business intelligence for established companies',
    directories: 150,
    support: 'Phone & priority support (12hr response)',
    processing: '1-2 business days',
    highlighted: false,
    popular: false,
    features: [
      '150 AI-optimized directory submissions',
      'SEO Content Gap Analysis tool',
      'AI-generated blog post ideas',
      'Custom market research reports',
      'White-label reporting',
      'Quarterly strategy consultations',
      'API access for integrations',
      'Custom business modeling',
      'Phone support'
    ],
    aiFeatures: [
      'SEO Content Gap Analysis',
      'Competitor content intelligence',
      'Keyword cluster generation',
      'Custom AI market research',
      'Business model optimization'
    ],
    valueProps: {
      timesSaved: '120+ hours of enterprise research',
      visibilityIncrease: 'Up to 700% increase in online visibility',
      newCustomers: '10-20 new customers per month',
      roiPercentage: '12x ROI (91% savings)',
      consultantEquivalent: '$6,000+ enterprise consulting',
      savings: '91% vs hiring consultant'
    },
    limits: {
      monthlySubmissions: 150,
      apiAccess: true,
      whiteLabel: true,
      customReports: true,
      dedicatedSupport: false,
      seoTools: true,
      competitorAnalysis: true
    }
  },

  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 799,
    originalValue: 8000,
    description: 'Complete AI-powered business intelligence suite with dedicated support',
    shortDescription: 'Ultimate solution for large organizations and agencies',
    directories: 500,
    support: 'Dedicated account manager',
    processing: 'Same day processing',
    highlighted: false,
    popular: false,
    badge: 'PREMIUM SUITE',
    features: [
      '500+ AI-optimized directory submissions',
      'Advanced SEO Content Gap Analysis',
      'Competitor content intelligence',
      'AI-powered FAQ suggestions',
      'Keyword cluster generation',
      'Dedicated AI business analyst',
      'Real-time competitive monitoring',
      'Market expansion planning',
      'White-label reports & presentations',
      'Dedicated account manager',
      'Custom integrations'
    ],
    aiFeatures: [
      'Full AI intelligence suite',
      'Dedicated AI analyst',
      'Real-time competitive monitoring',
      'AI-powered market expansion',
      'Custom AI business modeling',
      'Advanced SEO content analysis'
    ],
    valueProps: {
      timesSaved: '200+ hours of executive consulting',
      visibilityIncrease: 'Up to 1000% increase in online visibility',
      newCustomers: '20-50 new customers per month',
      roiPercentage: '10x ROI (87% savings)',
      consultantEquivalent: '$8,000+ executive consulting',
      savings: '90% vs hiring consultant'
    },
    limits: {
      monthlySubmissions: 500,
      apiAccess: true,
      whiteLabel: true,
      customReports: true,
      dedicatedSupport: true,
      seoTools: true,
      competitorAnalysis: true
    }
  }
}

// STRIPE PRICE IDs (to be configured in Stripe dashboard)
export const STRIPE_PRICE_IDS = {
  starter: process.env.STRIPE_STARTER_PRICE_ID || 'price_starter_one_time_dev',
  growth: process.env.STRIPE_GROWTH_PRICE_ID || 'price_growth_one_time_dev',
  professional: process.env.STRIPE_PROFESSIONAL_PRICE_ID || 'price_professional_one_time_dev',
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_one_time_dev'
}

// FEATURE ACCESS VALIDATION
export function canAccessFeature(userTier: string, feature: string): boolean {
  const tier = PRICING_TIERS[userTier]
  if (!tier) return false
  
  // Check if feature exists in tier limits
  const limits = tier.limits as any
  if (limits[feature] !== undefined) {
    return limits[feature]
  }
  
  // Check if feature exists in features array
  return tier.features.some(f => f.toLowerCase().includes(feature.toLowerCase())) ||
         tier.aiFeatures.some(f => f.toLowerCase().includes(feature.toLowerCase()))
}

// GET TIER BY ID
export function getTier(tierId: string): PricingTier | null {
  return PRICING_TIERS[tierId] || null
}

// GET ALL TIERS AS ARRAY
export function getAllTiers(): PricingTier[] {
  return Object.values(PRICING_TIERS)
}

// GET TIER COMPARISON DATA
export function getTierComparison(): Array<{
  feature: string
  starter: boolean | string
  growth: boolean | string  
  professional: boolean | string
  enterprise: boolean | string
}> {
  return [
    {
      feature: 'Directory Submissions',
      starter: '25 submissions',
      growth: '75 submissions',
      professional: '150 submissions', 
      enterprise: '500+ submissions'
    },
    {
      feature: 'AI Analysis',
      starter: 'Basic',
      growth: 'Advanced',
      professional: 'Enterprise-grade',
      enterprise: 'Full AI Suite'
    },
    {
      feature: 'SEO Content Gap Analysis',
      starter: false,
      growth: false,
      professional: true,
      enterprise: true
    },
    {
      feature: 'Competitor Analysis',
      starter: false,
      growth: true,
      professional: true,
      enterprise: true
    },
    {
      feature: 'White-label Reports',
      starter: false,
      growth: false,
      professional: true,
      enterprise: true
    },
    {
      feature: 'API Access',
      starter: false,
      growth: false,
      professional: true,
      enterprise: true
    },
    {
      feature: 'Support Level',
      starter: 'Email (48hr)',
      growth: 'Priority (24hr)',
      professional: 'Phone (12hr)',
      enterprise: 'Dedicated Manager'
    },
    {
      feature: 'Processing Time',
      starter: '5-7 days',
      growth: '3-5 days',
      professional: '1-2 days',
      enterprise: 'Same day'
    }
  ]
}

// PRICING VALIDATION
export function validatePricing(): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Check all tiers have required fields
  Object.entries(PRICING_TIERS).forEach(([key, tier]) => {
    if (!tier.name) errors.push(`${key}: Missing name`)
    if (!tier.price || tier.price <= 0) errors.push(`${key}: Invalid price`)
    if (!tier.features || tier.features.length === 0) errors.push(`${key}: Missing features`)
    if (!tier.directories || tier.directories <= 0) errors.push(`${key}: Invalid directory count`)
  })
  
  // Check price progression
  const prices = Object.values(PRICING_TIERS).map(t => t.price).sort((a, b) => a - b)
  const originalPrices = Object.values(PRICING_TIERS).map(t => t.price)
  if (JSON.stringify(prices) !== JSON.stringify(originalPrices)) {
    errors.push('Pricing tiers are not in ascending order')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

const pricingConfig = {
  PRICING_TIERS,
  STRIPE_PRICE_IDS,
  canAccessFeature,
  getTier,
  getAllTiers,
  getTierComparison,
  validatePricing
}

export default pricingConfig
