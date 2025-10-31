// 🔒 TIERED ANALYSIS SYSTEM DATABASE SCHEMA
// Enhanced schema for AI analysis tier tracking and usage management

import type { User, Subscription } from './schema'

// Extended User interface with analysis-specific tracking
export interface UserWithAnalysisTier extends User {
  // Analysis usage tracking
  ai_analyses_used_this_month: number
  ai_analysis_limit: number
  last_analysis_reset_at: Date
  
  // Analysis features by tier
  has_basic_extraction: boolean
  has_ai_competitor_analysis: boolean
  has_advanced_insights: boolean
  has_priority_processing: boolean
  
  // Cost tracking
  total_ai_cost_this_month: number // In cents
  ai_cost_limit: number // In cents
  
  // Conversion tracking
  tier_upgrade_prompted_at?: Date
  upgrade_conversion_source?: string
  free_tier_expires_at?: Date
}

// Analysis job tracking
export interface AnalysisJob {
  id: string // UUID primary key
  user_id: string // Foreign key to User
  
  // Job details
  type: AnalysisType
  input_data: Record<string, any> // Website URL, business info, etc.
  status: AnalysisJobStatus
  
  // Tier validation
  user_tier_at_creation: SubscriptionTier
  tier_validated: boolean
  feature_access_validated: boolean
  
  // AI usage and costs
  openai_tokens_used?: number
  anthropic_tokens_used?: number
  total_ai_cost: number // In cents
  estimated_cost_before_run: number // In cents
  
  // Processing details
  started_at?: Date
  completed_at?: Date
  failed_at?: Date
  processing_time_ms?: number
  
  // Results
  extraction_results?: Record<string, any>
  ai_insights?: Record<string, any>
  competitor_analysis?: Record<string, any>
  
  // Error handling
  error_message?: string
  error_type?: AnalysisErrorType
  retry_count: number
  max_retries: number
  
  created_at: Date
  updated_at: Date
}

// Monthly usage tracking per user
export interface UserAnalysisUsage {
  id: string // UUID primary key
  user_id: string // Foreign key to User
  
  // Time period
  year: number
  month: number // 1-12
  
  // Usage counts by analysis type
  basic_extractions_used: number
  ai_competitor_analyses_used: number
  advanced_insights_used: number
  
  // Cost tracking
  total_ai_cost: number // In cents
  openai_cost: number // In cents
  anthropic_cost: number // In cents
  
  // Tier information
  subscription_tier: SubscriptionTier
  tier_limit_reached: boolean
  upgrade_prompted: boolean
  upgrade_completed: boolean
  
  created_at: Date
  updated_at: Date
}

// Cost tracking for AI provider usage
export interface AiCostTracking {
  id: string // UUID primary key
  analysis_job_id: string // Foreign key to AnalysisJob
  user_id: string // Foreign key to User
  
  // AI Provider details
  provider: AiProvider
  model_used: string
  
  // Token usage
  input_tokens: number
  output_tokens: number
  total_tokens: number
  
  // Cost calculation
  cost_per_input_token: number // In cents per token
  cost_per_output_token: number // In cents per token
  total_cost: number // In cents
  
  // Metadata
  request_id: string
  response_time_ms: number
  
  created_at: Date
}

// Tier upgrade tracking
export interface TierUpgradeEvent {
  id: string // UUID primary key
  user_id: string // Foreign key to User
  
  // Upgrade details
  from_tier: SubscriptionTier
  to_tier: SubscriptionTier
  upgrade_source: UpgradeSource
  
  // Trigger information
  triggered_by_limit: boolean
  limit_type?: LimitType
  analyses_used_when_triggered: number
  cost_spent_when_triggered: number // In cents
  
  // Conversion tracking
  prompt_shown_at: Date
  upgrade_completed_at?: Date
  conversion_time_minutes?: number
  
  // Revenue
  upgrade_amount: number // In cents
  stripe_subscription_id?: string
  
  created_at: Date
}

// Import centralized pricing configuration
import { PRICING_TIERS, canAccessFeature as checkFeatureAccess } from '../config/pricing'

// Use centralized pricing for analysis tiers
export const ANALYSIS_TIERS = {
  free: {
    name: 'Free',
    monthlyAnalysisLimit: 3,
    features: {
      basicExtraction: true,
      aiCompetitorAnalysis: false,
      advancedInsights: false,
      priorityProcessing: false,
      exportFormats: ['json'],
      supportLevel: 'community',
      seoTools: false,
      competitorAnalysis: false
    },
    costLimits: {
      monthlyAiCostLimit: 500, // $5.00 in cents
      perAnalysisLimit: 200 // $2.00 in cents
    }
  },
  starter: {
    name: `Starter - $149 one-time`,
    monthlyAnalysisLimit: 25,
    features: {
      basicExtraction: true,
      aiCompetitorAnalysis: true,
      advancedInsights: false,
      priorityProcessing: false,
      exportFormats: ['json', 'csv'],
      supportLevel: 'email',
      seoTools: false,
      competitorAnalysis: false
    },
    costLimits: {
      monthlyAiCostLimit: 5000, // $50.00 in cents
      perAnalysisLimit: 500 // $5.00 in cents
    }
  },
  growth: {
    name: `Growth - $299 one-time`,
    monthlyAnalysisLimit: 75,
    features: {
      basicExtraction: true,
      aiCompetitorAnalysis: true,
      advancedInsights: true,
      priorityProcessing: false,
      exportFormats: ['json', 'csv', 'pdf'],
      supportLevel: 'priority',
      seoTools: true,
      competitorAnalysis: true
    },
    costLimits: {
      monthlyAiCostLimit: 15000, // $150.00 in cents
      perAnalysisLimit: 1000 // $10.00 in cents
    }
  },
  professional: {
    name: 'Professional - $499/month',
    monthlyAnalysisLimit: 300,
    features: {
      basicExtraction: true,
      aiCompetitorAnalysis: true,
      advancedInsights: true,
      priorityProcessing: true,
      exportFormats: ['json', 'csv', 'pdf', 'xlsx'],
      supportLevel: 'priority'
    },
    costLimits: {
      monthlyAiCostLimit: 30000, // $300.00 in cents
      perAnalysisLimit: 2000 // $20.00 in cents
    }
  },
  enterprise: {
    name: 'Enterprise - $799/month',
    monthlyAnalysisLimit: -1, // Unlimited
    features: {
      basicExtraction: true,
      aiCompetitorAnalysis: true,
      advancedInsights: true,
      priorityProcessing: true,
      exportFormats: ['json', 'csv', 'pdf', 'xlsx', 'xml'],
      supportLevel: 'dedicated'
    },
    costLimits: {
      monthlyAiCostLimit: 100000, // $1000.00 in cents
      perAnalysisLimit: 5000 // $50.00 in cents
    }
  }
} as const

// Type definitions
export type SubscriptionTier = keyof typeof ANALYSIS_TIERS
export type AnalysisType = 'basic_extraction' | 'ai_competitor_analysis' | 'advanced_insights' | 'full_analysis'
export type AnalysisJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'tier_blocked'
export type AnalysisErrorType = 'tier_limit_exceeded' | 'cost_limit_exceeded' | 'api_failure' | 'invalid_input' | 'processing_timeout'
export type AiProvider = 'openai' | 'anthropic' | 'local'
export type UpgradeSource = 'analysis_limit' | 'cost_limit' | 'feature_required' | 'manual' | 'sales'
export type LimitType = 'monthly_analyses' | 'monthly_cost' | 'per_analysis_cost' | 'feature_access'

// Database indexes for optimal performance
export const TIER_DATABASE_INDEXES = {
  analysis_jobs: [
    { fields: ['user_id', 'created_at'] },
    { fields: ['user_id', 'status'] },
    { fields: ['status', 'created_at'] },
    { fields: ['type', 'user_tier_at_creation'] },
    { fields: ['user_id', 'type', 'created_at'] }
  ],
  user_analysis_usage: [
    { fields: ['user_id', 'year', 'month'], unique: true },
    { fields: ['subscription_tier', 'tier_limit_reached'] },
    { fields: ['year', 'month', 'subscription_tier'] }
  ],
  ai_cost_tracking: [
    { fields: ['analysis_job_id'] },
    { fields: ['user_id', 'created_at'] },
    { fields: ['provider', 'model_used'] },
    { fields: ['user_id', 'provider', 'created_at'] }
  ],
  tier_upgrade_events: [
    { fields: ['user_id', 'created_at'] },
    { fields: ['from_tier', 'to_tier'] },
    { fields: ['upgrade_source', 'upgrade_completed_at'] },
    { fields: ['triggered_by_limit', 'limit_type'] }
  ]
} as const

// Utility functions for tier management
export function getTierConfig(tier: SubscriptionTier) {
  return ANALYSIS_TIERS[tier]
}

export function canAccessFeature(tier: SubscriptionTier, feature: keyof typeof ANALYSIS_TIERS[SubscriptionTier]['features']): boolean {
  const featureValue = ANALYSIS_TIERS[tier].features[feature]
  return typeof featureValue === 'boolean' ? featureValue : !!featureValue
}

export function getMonthlyLimit(tier: SubscriptionTier): number {
  return ANALYSIS_TIERS[tier].monthlyAnalysisLimit
}

export function getCostLimits(tier: SubscriptionTier) {
  return ANALYSIS_TIERS[tier].costLimits
}

export function getNextTier(currentTier: SubscriptionTier): SubscriptionTier | null {
  const tiers: SubscriptionTier[] = ['free', 'starter', 'growth', 'professional', 'enterprise']
  const currentIndex = tiers.indexOf(currentTier)
  
  if (currentIndex === -1 || currentIndex === tiers.length - 1) {
    return null
  }
  
  return tiers[currentIndex + 1] || null
}

// Validation schemas
export const TIER_VALIDATION = {
  analysisTypes: ['basic_extraction', 'ai_competitor_analysis', 'advanced_insights', 'full_analysis'],
  subscriptionTiers: ['free', 'starter', 'growth', 'professional', 'enterprise'],
  aiProviders: ['openai', 'anthropic', 'local']
} as const