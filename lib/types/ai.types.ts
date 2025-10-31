// 🤖 AI BUSINESS INTELLIGENCE TYPES
// Complete type definitions for AI-powered business analysis

export interface BusinessProfile {
  name: string
  industry: string
  category: string
  description: string
  targetAudience: string[]
  businessModel: string
  location?: string
  website: string
  foundingYear?: number
  employeeCount?: string
  revenue?: string
  keyProducts?: string[]
  keyServices?: string[]
  uniqueSellingProposition?: string
  marketPosition?: string
}

export interface CompetitiveAnalysis {
  marketPosition: string
  competitiveAdvantages: string[]
  competitiveDisadvantages: string[]
  keyCompetitors: Competitor[]
  marketShare?: number
  competitiveGaps: string[]
  opportunityAreas: string[]
  threatAnalysis: string[]
  recommendedStrategies: string[]
}

export interface Competitor {
  name: string
  website: string
  marketPosition: string
  strengths: string[]
  weaknesses: string[]
  marketShare?: number
  pricingStrategy?: string
  keyDifferentiators: string[]
}

export interface SEOAnalysis {
  currentScore: number
  technicalSEO: {
    score: number
    issues: string[]
    recommendations: string[]
  }
  contentSEO: {
    score: number
    keywordOpportunities: string[]
    contentGaps: string[]
    recommendations: string[]
  }
  localSEO: {
    score: number
    currentListings: number
    missedOpportunities: number
    recommendations: string[]
  }
  improvementAreas: string[]
  priorityActions: string[]
  estimatedImpact: {
    trafficIncrease: number
    rankingImprovement: number
    timeframe: string
  }
}

export interface MarketInsights {
  marketSize: string
  growthRate: number
  marketTrends: string[]
  customerBehavior: string[]
  seasonalFactors: string[]
  emergingOpportunities: string[]
  marketChallenges: string[]
  recommendedTiming: string[]
}

export interface DirectoryOpportunity {
  name: string
  url: string
  authority: number
  category: string
  estimatedTraffic: number
  submissionDifficulty: 'Easy' | 'Medium' | 'Hard'
  cost: number
  successProbability: number
  reasoning: string
  estimatedTimeToApproval: string
  requiredInformation: string[]
  benefits: string[]
  industryRelevance: number
  geographicRelevance?: number
  businessModelFit: number
}

export interface RevenueProjection {
  timeframe: string
  conservative: {
    projectedRevenue: number
    trafficIncrease: number
    leadIncrease: number
    conversionRate: number
    confidence: number
  }
  optimistic: {
    projectedRevenue: number
    trafficIncrease: number
    leadIncrease: number
    conversionRate: number
    confidence: number
  }
  assumptions: string[]
  keyFactors: string[]
}

export interface AIInsights {
  businessProfile: BusinessProfile
  marketInsights: MarketInsights
  competitiveAnalysis: CompetitiveAnalysis
  seoAnalysis: SEOAnalysis
  revenueProjections: RevenueProjection
  actionableRecommendations: string[]
  priorityScore: number
  confidenceLevel: number
}

export interface UpgradePrompts {
  title: string
  description: string
  benefits: string[]
  ctaText: string
  ctaUrl: string
  savings: string
  urgency?: string
  socialProof?: string
}

export interface UsageMetrics {
  tokensUsed: number
  cost: number
  processingTime: number
  apiCalls: number
  cacheHits?: number
}

export interface BusinessIntelligenceResponse {
  // Basic Information
  url: string
  title: string
  description: string
  tier: string
  timestamp: string
  
  // Core Metrics
  visibility: number
  seoScore: number
  potentialLeads: number
  currentListings?: number
  missedOpportunities?: number
  
  // Directory Opportunities
  directoryOpportunities: DirectoryOpportunity[]
  
  // AI Analysis (Paid Tiers Only)
  aiAnalysis?: AIInsights
  
  // Upgrade Information (Free Tier)
  upgradePrompts?: UpgradePrompts
  
  // Usage Information
  usage?: UsageMetrics
  
  // Additional Data
  screenshots?: string[]
  socialMediaLinks?: string[]
  contactInformation?: {
    email?: string
    phone?: string
    address?: string
  }
  
  // Success Indicators
  successFactors?: string[]
  riskFactors?: string[]
  
  // Recommendations
  immediateActions?: string[]
  longTermStrategy?: string[]
}

export interface AnalysisRequest {
  url: string
  tier: string
  userId?: string
  sessionId?: string
  preferences?: {
    focusAreas?: string[]
    geographicTargets?: string[]
    competitorFocus?: string[]
    industrySpecific?: boolean
  }
}

export interface AnalysisError {
  code: string
  message: string
  details?: string
  retryable: boolean
  suggestedAction?: string
}

// Export utility types
export type AnalysisTier = 'free' | 'starter' | 'growth' | 'professional' | 'enterprise'
export type BusinessCategory = 'B2B' | 'B2C' | 'B2B2C' | 'Marketplace' | 'SaaS' | 'E-commerce' | 'Service' | 'Local'
export type IndustryType = 'Technology' | 'Healthcare' | 'Finance' | 'Retail' | 'Manufacturing' | 'Education' | 'Real Estate' | 'Professional Services' | 'Food & Beverage' | 'Other'