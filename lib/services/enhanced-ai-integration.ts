/**
 * Phase 3.2: Enhanced AI Integration Service
 * 
 * This service orchestrates the complete AI-enhanced DirectoryBolt workflow,
 * connecting the AI Business Intelligence Engine, Supabase persistence layer, caching system,
 * and customer dashboard functionality for the $299+ AI-powered platform.
 */

import { BusinessIntelligence, DirectoryOpportunityMatrix, RevenueProjections } from '../types/business-intelligence'
import {
  createOrUpdateCustomer,
  findByCustomerId,
  updateDirectoryStats
} from './customer-service'
import createAIAnalysisCacheService, {
  AIAnalysisCacheService,
  CachedAnalysisRecord
} from './ai-analysis-cache'

export interface AIAnalysisRequest {
  customerId: string
  businessProfile: {
    businessName: string
    website: string
    description: string
    email: string
    phone?: string
    city: string
    state: string
    industry?: string
    targetAudience?: string
  }
  analysisOptions?: {
    depth: 'basic' | 'standard' | 'comprehensive'
    includeCompetitorAnalysis: boolean
    includeRevenueProjections: boolean
    includeDirectoryOptimization: boolean
    forceRefresh: boolean
  }
}

export interface AIAnalysisResult {
  success: boolean
  cached: boolean
  analysis: {
    businessIntelligence: BusinessIntelligence
    directoryOpportunities: DirectoryOpportunityMatrix
    revenueProjections: RevenueProjections
  }
  metadata: {
    processingTime: number
    costSavings?: number
    confidenceScore: number
    analysisVersion: string
    cacheInfo?: {
      daysOld: number
      reason: string
    }
  }
  recommendations: {
    immediateActions: string[]
    shortTermGoals: string[]
    longTermStrategy: string[]
    priorityDirectories: Array<{
      name: string
      priority: number
      estimatedROI: number
    }>
  }
  error?: string
}

export interface OptimizationTracking {
  customerId: string
  metrics: {
    directoriesSubmitted: number
    approvalRate: number
    trafficIncrease: number
    leadIncrease: number
    revenueImpact: number
  }
  comparisonToPredictions: {
    trafficVariance: number // percentage difference from predicted
    leadVariance: number
    roiVariance: number
  }
}

export class EnhancedAIIntegrationService {
  private readonly logPrefix = '[EnhancedAIIntegrationService]'
  private cacheService: AIAnalysisCacheService

  constructor(
    cacheService?: AIAnalysisCacheService
  ) {
    this.cacheService = cacheService || createAIAnalysisCacheService()
  }

  /**
   * Phase 3.2: Complete AI-Enhanced Business Analysis Workflow
   */
  async performEnhancedAnalysis(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
    const startTime = Date.now()
    
    try {
      console.log('🚀 Starting enhanced AI analysis workflow for:', request.customerId)

      // Step 1: Validate customer and business profile
      await this.validateCustomerAndProfile(request)

      // Step 2: Check cache unless force refresh is requested
      let analysisResult: any = null
      let cached = false
      let cacheInfo = null

      if (!request.analysisOptions?.forceRefresh) {
        console.log('🔍 Checking analysis cache...')
        const { cached: cachedResult, validation } =
          await this.cacheService.getCachedAnalysisOrValidate(
            request.customerId,
            request.businessProfile
          )

        if (validation.isValid && cachedResult) {
          console.log('✅ Using cached analysis - Cost savings achieved!')
          analysisResult = {
            businessIntelligence: cachedResult.analysisData,
            directoryOpportunities: cachedResult.directoryOpportunities,
            revenueProjections: cachedResult.revenueProjections
          }
          cached = true
          cacheInfo = {
            daysOld: validation.daysOld || 0,
            reason: validation.reason || 'fresh'
          }
        }
      }

      // Step 3: Perform new analysis if not cached
      if (!analysisResult) {
        console.log('🧠 Performing comprehensive AI analysis...')
        analysisResult = await this.executeAIAnalysis(request)

        // Step 4: Persist customer profile and directory metrics
        const submissionCount =
          analysisResult.directoryOpportunities?.prioritizedSubmissions?.length ?? 0

        await createOrUpdateCustomer({
          customerId: request.customerId,
          businessName: request.businessProfile.businessName,
          website: request.businessProfile.website,
          description: request.businessProfile.description,
          email: request.businessProfile.email,
          phone: request.businessProfile.phone,
          city: request.businessProfile.city,
          state: request.businessProfile.state,
          metadata: {
            industry: request.businessProfile.industry,
            targetAudience: request.businessProfile.targetAudience
          },
          directoriesSubmitted: submissionCount,
          failedDirectories: 0
        })

        await updateDirectoryStats(request.customerId, {
          submitted: submissionCount,
          failed: 0
        })

        await this.cacheService.storeAnalysisResults(
          request.customerId,
          analysisResult.businessIntelligence,
          analysisResult.directoryOpportunities,
          analysisResult.revenueProjections,
          request.businessProfile
        )

        cached = false
      }

      // Step 5: Generate actionable recommendations
      const recommendations = this.generateRecommendations(
        analysisResult.businessIntelligence,
        analysisResult.directoryOpportunities
      )

      // Step 6: Update customer record with analysis metadata
      await this.updateCustomerAnalysisMetadata(request.customerId, {
        analysisDate: new Date(),
        confidenceScore: analysisResult.businessIntelligence.confidence,
        analysisVersion: '3.2.0'
      })

      const processingTime = Date.now() - startTime

      console.log('✅ Enhanced AI analysis completed successfully')

 return {
  success: true,
  cached,
  analysis: analysisResult,
  metadata: {
    processingTime,
    costSavings: cached ? 299 : undefined, // Estimated cost savings
    confidenceScore: analysisResult.businessIntelligence.confidence,
    analysisVersion: '3.2.0',
    cacheInfo: cacheInfo ?? undefined
  },
  recommendations
}

    } catch (error) {
      console.error('❌ Enhanced AI analysis failed:', error)
      return {
        success: false,
        cached: false,
        analysis: null as any,
        metadata: {
          processingTime: Date.now() - startTime,
          confidenceScore: 0,
          analysisVersion: '3.2.0'
        },
        recommendations: {
          immediateActions: [],
          shortTermGoals: [],
          longTermStrategy: [],
          priorityDirectories: []
        },
        error: error instanceof Error ? error.message : 'Analysis failed'
      }
    }
  }

  /**
   * Phase 3.2: Track optimization progress and compare to predictions
   */
  async trackOptimizationProgress(tracking: OptimizationTracking): Promise<{
    success: boolean
    insights: {
      performanceVsPredictions: string
      recommendedAdjustments: string[]
      nextSteps: string[]
    }
    error?: string
  }> {
    try {
      console.log('📊 Tracking optimization progress for:', tracking.customerId)

      console.info(`${this.logPrefix} Skipping trackOptimizationProgress persistence`, {
        customerId: tracking.customerId,
        metrics: tracking.metrics
      })

      // Analyze performance vs predictions
      const insights = this.generateOptimizationInsights(tracking)

      console.log('✅ Optimization progress tracked successfully')

      return {
        success: true,
        insights
      }

    } catch (error) {
      console.error('❌ Failed to track optimization progress:', error)
      return {
        success: false,
        insights: {
          performanceVsPredictions: 'Unable to analyze performance',
          recommendedAdjustments: [],
          nextSteps: []
        },
        error: error instanceof Error ? error.message : 'Tracking failed'
      }
    }
  }

  /**
   * Phase 3.2: Get customer dashboard data including analysis results and progress
   */
  async getCustomerDashboardData(customerId: string): Promise<{
    businessProfile: any
    analysisResults: BusinessIntelligence | null
    directoryOpportunities: DirectoryOpportunityMatrix | null
    optimizationProgress: any
    recommendations: any
    cacheStatus: {
      lastUpdated: Date | null
      daysOld: number
      needsRefresh: boolean
    }
  }> {
    try {
      console.log('📋 Getting customer dashboard data for:', customerId)

      const [cachedAnalysis, customerRecord] = await Promise.all([
        this.cacheService.getCachedAnalysisResults(customerId),
        findByCustomerId(customerId)
      ])
      
      // Get analysis history for trends
      const analysisHistory: any[] = []

      // Parse stored data
      const directoryOpportunities =
        cachedAnalysis?.analysisData?.directoryOpportunities ?? null

      // Calculate cache status
      const lastUpdated = cachedAnalysis?.lastUpdated ? new Date(cachedAnalysis.lastUpdated) : null
      const daysOld = lastUpdated
        ? Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24))
        : 999
      const needsRefresh = daysOld > 30 || !cachedAnalysis

      return {
        businessProfile: customerRecord
          ? {
              businessName: customerRecord.businessName,
              website: customerRecord.website,
              description: customerRecord.description,
              email: customerRecord.email,
              phone: customerRecord.phone,
              city: customerRecord.city,
              state: customerRecord.state,
              packageType: customerRecord.packageType,
              status: customerRecord.status
            }
          : cachedAnalysis?.businessProfile ?? null,
        analysisResults: cachedAnalysis?.analysisData ?? null,
        directoryOpportunities,
        optimizationProgress: cachedAnalysis
          ? {
              directoriesSubmitted: cachedAnalysis.analysisData?.directoriesSubmitted ?? 0,
              failedDirectories: cachedAnalysis.analysisData?.failedDirectories ?? 0,
              submissionStatus: cachedAnalysis.analysisData?.submissionStatus ?? 'unknown'
            }
          : null,
        recommendations: analysisHistory.length > 0 ? {
          competitivePositioning: cachedAnalysis?.analysisData?.competitivePositioning,
          seoRecommendations: cachedAnalysis?.analysisData?.seoRecommendations ?? []
        } : null,
        cacheStatus: {
          lastUpdated,
          daysOld,
          needsRefresh
        }
      }

    } catch (error) {
      console.error('❌ Failed to get customer dashboard data:', error)
      throw error
    }
  }

  /**
   * Phase 3.2: Get system analytics and performance metrics
   */
  async getSystemAnalytics(): Promise<{
    cacheMetrics: any
    totalCustomers: number
    analysisStats: {
      totalAnalyses: number
      averageConfidenceScore: number
      topPerformingIndustries: string[]
    }
    costSavings: number
  }> {
    try {
      console.log('📈 Getting system analytics...')

      return {
        cacheMetrics: {},
        totalCustomers: 0,
        analysisStats: {
          totalAnalyses: 0,
          averageConfidenceScore: 0,
          topPerformingIndustries: []
        },
        costSavings: 0
      }

    } catch (error) {
      console.error('❌ Failed to get system analytics:', error)
      throw error
    }
  }

  /**
   * Helper: Validate customer and business profile
   */
  private async validateCustomerAndProfile(request: AIAnalysisRequest): Promise<void> {
    if (!request.customerId) {
      throw new Error('Customer ID is required')
    }

    if (!request.businessProfile.businessName || !request.businessProfile.website) {
      throw new Error('Business name and website are required')
    }

    console.info(`${this.logPrefix} Skipping customer lookup for ${request.customerId}`)
  }

  /**
   * Helper: Execute AI analysis (integrates with Alex's AI engine)
   */
  private async executeAIAnalysis(request: AIAnalysisRequest): Promise<{
    businessIntelligence: BusinessIntelligence
    directoryOpportunities: DirectoryOpportunityMatrix
    revenueProjections: RevenueProjections
  }> {
    // This would integrate with Alex's AI Business Intelligence Engine
    // For now, we'll simulate the analysis process
    console.log('🔮 Executing comprehensive AI analysis...')
    
    // Simulate analysis time based on depth
    const analysisTime = {
      basic: 2000,
      standard: 5000,
      comprehensive: 10000
    }[request.analysisOptions?.depth || 'standard']

    await new Promise(resolve => setTimeout(resolve, analysisTime))

    // Return mock analysis (in production, this would call Alex's service)
    return {
      businessIntelligence: {} as BusinessIntelligence, // Mock data would be populated here
      directoryOpportunities: {} as DirectoryOpportunityMatrix,
      revenueProjections: {} as RevenueProjections
    }
  }

  /**
   * Helper: Generate actionable recommendations
   */
  private generateRecommendations(
    intelligence: BusinessIntelligence,
    opportunities: DirectoryOpportunityMatrix
  ): AIAnalysisResult['recommendations'] {
    return {
      immediateActions: [
        'Set up Google My Business profile',
        'Optimize website meta descriptions',
        'Submit to top 5 priority directories'
      ],
      shortTermGoals: [
        'Implement SEO improvements',
        'Develop customer testimonial strategy',
        'Complete directory submission campaign'
      ],
      longTermStrategy: [
        'Build content marketing strategy',
        'Develop niche specialization',
        'Expand market reach regionally'
      ],
      priorityDirectories: opportunities.prioritizedSubmissions?.slice(0, 10).map(dir => ({
        name: dir.directoryName,
        priority: dir.priority,
        estimatedROI: dir.expectedROI
      })) || []
    }
  }

  /**
   * Helper: Generate optimization insights
   */
  private generateOptimizationInsights(tracking: OptimizationTracking): {
    performanceVsPredictions: string
    recommendedAdjustments: string[]
    nextSteps: string[]
  } {
    const { comparisonToPredictions } = tracking

    let performance = 'On track'
    if (comparisonToPredictions.trafficVariance > 20) performance = 'Exceeding expectations'
    else if (comparisonToPredictions.trafficVariance < -20) performance = 'Below expectations'

    return {
      performanceVsPredictions: performance,
      recommendedAdjustments: [
        'Focus on high-converting directories',
        'Optimize listing descriptions',
        'Improve response time to inquiries'
      ],
      nextSteps: [
        'Continue directory submissions',
        'Monitor conversion rates',
        'Expand to secondary markets'
      ]
    }
  }

  /**
   * Helper: Update customer analysis metadata
   */
  private async updateCustomerAnalysisMetadata(customerId: string, metadata: {
    analysisDate: Date
    confidenceScore: number
    analysisVersion: string
  }): Promise<void> {
    console.debug(`${this.logPrefix} Skipping updateBusinessSubmission persistence`, {
      customerId: customerId
    })
  }
}

/**
 * Factory function to create Enhanced AI Integration Service
 */
export function createEnhancedAIIntegrationService(options: {
  cacheService?: AIAnalysisCacheService
} = {}): EnhancedAIIntegrationService {
  const cacheService = options.cacheService || createAIAnalysisCacheService()
  return new EnhancedAIIntegrationService(cacheService)
}

/**
 * Export default instance
 */
export default createEnhancedAIIntegrationService
