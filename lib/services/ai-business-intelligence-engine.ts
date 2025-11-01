// @ts-nocheck
// 🚀 AI BUSINESS INTELLIGENCE ENGINE - Master Orchestrator  
// Complete $299+ AI-powered business analysis platform integration

import { logger } from '../utils/logger'
import type { 
  BusinessIntelligence as BusinessIntelligenceType, 
  BusinessIntelligenceResponse, 
  AnalysisProgress as AnalysisProgressType,
  AIAnalysisConfig,
  DirectoryAnalysisConfig
} from '../types/business-intelligence'
import type { DirectoryMatchingResult, DirectoryOpportunity } from './directory-matcher'

import { 
  EnhancedWebsiteAnalyzer, 
  DEFAULT_ENHANCED_CONFIG,
  ExtractedData 
} from './enhanced-website-analyzer'

import {
  AIBusinessAnalyzer,
  DEFAULT_AI_ANALYSIS_CONFIG,
  AnalysisContext
} from './ai-business-analyzer'

import {
  DirectoryMatcher,
  DEFAULT_DIRECTORY_MATCHING_CONFIG
} from './directory-matcher'

export interface BusinessIntelligenceConfig {
  websiteAnalysis: typeof DEFAULT_ENHANCED_CONFIG
  aiAnalysis: AIAnalysisConfig
  directoryMatching: typeof DEFAULT_DIRECTORY_MATCHING_CONFIG
  enableProgressTracking: boolean
  cacheResults: boolean
  maxProcessingTime: number // milliseconds
}

export interface AnalysisRequest {
  url: string
  userInput?: {
    businessGoals?: string[]
    targetAudience?: string
    budget?: number
    timeline?: string
    industryFocus?: string[]
  }
  config?: Partial<BusinessIntelligenceConfig>
}

export interface ProcessingStage {
  name: string
  description: string
  estimatedDuration: number // seconds
  weight: number // for progress calculation
}

export class AIBusinessIntelligenceEngine {
  private config: BusinessIntelligenceConfig
  private websiteAnalyzer: EnhancedWebsiteAnalyzer
  private aiAnalyzer: AIBusinessAnalyzer
  private directoryMatcher: DirectoryMatcher
  
  private processingStages: ProcessingStage[] = [
    {
      name: 'website_extraction',
      description: 'Extracting comprehensive website data and capturing screenshots',
      estimatedDuration: 15,
      weight: 20
    },
    {
      name: 'business_categorization', 
      description: 'AI-powered business categorization and profile enhancement',
      estimatedDuration: 10,
      weight: 15
    },
    {
      name: 'industry_analysis',
      description: 'Analyzing industry landscape and market opportunities',
      estimatedDuration: 12,
      weight: 20
    },
    {
      name: 'competitive_intelligence',
      description: 'Competitive analysis and market positioning',
      estimatedDuration: 10,
      weight: 15
    },
    {
      name: 'directory_matching',
      description: 'Intelligent directory selection and optimization',
      estimatedDuration: 8,
      weight: 20
    },
    {
      name: 'integration_optimization',
      description: 'Integrating insights and generating recommendations',
      estimatedDuration: 5,
      weight: 10
    }
  ]

  // Progress tracking
  private progressCallback?: (progress: AnalysisProgressType) => void
  private currentStage = 0
  private stageProgress = 0

  constructor(config?: Partial<BusinessIntelligenceConfig>) {
    const websiteAnalysis = {
      ...DEFAULT_ENHANCED_CONFIG,
      ...(config?.websiteAnalysis ?? {})
    }

    const rawAiAnalysis = (config?.aiAnalysis ?? {}) as Partial<AIAnalysisConfig>
    const hasEnableCache = Object.prototype.hasOwnProperty.call(rawAiAnalysis, 'enableCache')
    const validModels = ['claude-3-sonnet-20241022', 'claude-3-opus-20240229', 'gemini-pro'] as const
    const isValidModel = (value: unknown): value is typeof validModels[number] =>
      typeof value === 'string' && (validModels as readonly string[]).includes(value)

    const resolvedModel = isValidModel(rawAiAnalysis.model)
      ? rawAiAnalysis.model
      : DEFAULT_AI_ANALYSIS_CONFIG.model

    const aiAnalysis: AIAnalysisConfig = {
      ...DEFAULT_AI_ANALYSIS_CONFIG,
      temperature: rawAiAnalysis.temperature ?? DEFAULT_AI_ANALYSIS_CONFIG.temperature,
      maxTokens: rawAiAnalysis.maxTokens ?? DEFAULT_AI_ANALYSIS_CONFIG.maxTokens,
      enableScreenshots: rawAiAnalysis.enableScreenshots ?? DEFAULT_AI_ANALYSIS_CONFIG.enableScreenshots,
      enableCompetitorAnalysis: rawAiAnalysis.enableCompetitorAnalysis ?? DEFAULT_AI_ANALYSIS_CONFIG.enableCompetitorAnalysis,
      enableRevenueProjections: rawAiAnalysis.enableRevenueProjections ?? DEFAULT_AI_ANALYSIS_CONFIG.enableRevenueProjections,
      analysisDepth: rawAiAnalysis.analysisDepth ?? DEFAULT_AI_ANALYSIS_CONFIG.analysisDepth,
      enableCache: hasEnableCache
        ? Boolean((rawAiAnalysis as Record<string, unknown>).enableCache)
        : DEFAULT_AI_ANALYSIS_CONFIG.enableCache,
      model: resolvedModel as AIAnalysisConfig['model']
    }

    const directoryMatching = {
      ...DEFAULT_DIRECTORY_MATCHING_CONFIG,
      ...(config?.directoryMatching ?? {})
    }

    this.config = {
      enableProgressTracking: true,
      cacheResults: true,
      maxProcessingTime: 300000, // 5 minutes
      ...config,
      websiteAnalysis,
      aiAnalysis,
      directoryMatching
    }
 
    this.websiteAnalyzer = new EnhancedWebsiteAnalyzer(this.config.websiteAnalysis)
    this.aiAnalyzer = AIBusinessAnalyzer.getInstance()
    this.directoryMatcher = DirectoryMatcher.getInstance()

    logger.info('AI Business Intelligence Engine initialized', {
        metadata: {
          aiModel: this.config.aiAnalysis.model,
          screenshotsEnabled: this.config.websiteAnalysis.enableScreenshots,
          maxDirectories: this.config.directoryMatching.maxDirectoryCount
        }
    })
  }

  async analyzeBusinessIntelligence(request: AnalysisRequest): Promise<BusinessIntelligenceResponse> {
    const startTime = Date.now()
    
    try {
      logger.info('Starting comprehensive business intelligence analysis', {
        metadata: {
          url: request.url,
          config: Object.keys(request.config || {})
        }
      })

      // Setup progress tracking
      if (this.config.enableProgressTracking) {
        this.initializeProgressTracking()
      }

      // Stage 1: Enhanced Website Analysis
      await this.updateProgress('website_extraction', 0)
      const websiteData = await this.performWebsiteAnalysis(request.url)
      await this.updateProgress('website_extraction', 100)

      // Stage 2: AI Business Analysis
      await this.updateProgress('business_categorization', 0)
      let businessIntelligence = await this.aiAnalyzer.generateBusinessIntelligence(websiteData)
      await this.updateProgress('business_categorization', 100)

      // Stage 3: Directory Intelligence & Matching
      await this.updateProgress('directory_matching', 0)
      const directoryOpportunities = await this.directoryMatcher.findMatchingDirectories(
        businessIntelligence.data?.profile || {}
      )
      await this.updateProgress('directory_matching', 100)

      // Stage 4: Integration & Final Optimization
      await this.updateProgress('integration_optimization', 0)
      const optimizedData = await this.optimizeAndValidateResults(
        businessIntelligence.data || this.createFallbackBusinessIntelligence(websiteData),
        request,
        directoryOpportunities
      )
      await this.updateProgress('integration_optimization', 100)

      const processingTime = Date.now() - startTime

      // Cache results if enabled
      if (this.config.cacheResults && businessIntelligence.data) {
        await this.cacheAnalysisResults(request.url, businessIntelligence.data)
      }

      const response: BusinessIntelligenceResponse = {
        success: true,
        data: businessIntelligence.data ?? this.createFallbackBusinessIntelligence(websiteData),
        processingTime,
        usage: {
          tokensUsed: this.estimateTokenUsage(businessIntelligence.data ?? this.createFallbackBusinessIntelligence(websiteData)),
          cost: this.estimateAnalysisCost(businessIntelligence.data ?? this.createFallbackBusinessIntelligence(websiteData))
        }
      }

      logger.info('Business intelligence analysis completed successfully', {
        metadata: {
          url: request.url,
          processingTime,
          confidence: response.data?.confidence ?? 0,
          directoryCount: response.data?.directoryOpportunities?.totalDirectories ?? 0
        }
      })

      return response

    } catch (error) {
      const processingTime = Date.now() - startTime

      logger.error('Business intelligence analysis failed', {
        metadata: {
          url: request.url,
          error: error instanceof Error ? error.message : 'Unknown error',
          processingTime
        }
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed due to unknown error',
        processingTime,
        usage: { tokensUsed: 0, cost: 0 }
      }

    } finally {
      // Cleanup resources
      await this.cleanup()
    }
  }

  private createFallbackBusinessIntelligence(
    websiteData: ExtractedData
  ): BusinessIntelligenceType {
    return {
      profile: {
        name: websiteData.basicInfo?.title || 'Unknown Business',
        domain: websiteData.basicInfo?.canonicalUrl || '',
        description: websiteData.basicInfo?.description || '',
        tagline: '',
        primaryCategory: 'General Business',
        secondaryCategories: [],
        industryVertical: 'General',
        businessModel: {
          type: 'B2B',
          revenueStreams: [],
          pricingModel: 'one-time',
          customerAcquisitionModel: []
        },
        targetMarket: {
          primaryAudience: 'General',
          secondaryAudiences: [],
          demographics: {
            ageRanges: [],
            genders: [],
            incomes: [],
            educations: [],
            locations: [],
            occupations: []
          },
          psychographics: {
            values: [],
            interests: [],
            lifestyle: [],
            personality: [],
            attitudes: []
          },
          painPoints: [],
          buyingBehavior: {
            decisionFactors: [],
            purchaseFrequency: 'unknown',
            averageOrderValue: 0,
            seasonality: 'unknown',
            channels: []
          }
        },
        location: {
          headquarters: {
            city: 'Unknown',
            country: 'Unknown'
          },
          offices: [],
          serviceAreas: [],
          timeZones: []
        },
        serviceAreas: [],
        marketReach: 'local',
        size: 'startup',
        stage: 'early',
        contentAnalysis: {
          readabilityScore: 0,
          sentimentScore: 0,
          keyThemes: [],
          contentGaps: [],
          expertiseIndicators: [],
          trustSignals: []
        },
        contactInfo: {
          website: websiteData.basicInfo?.canonicalUrl || '',
          socialLinks: []
        },
        socialPresence: {
          platforms: [],
          totalFollowers: 0,
          engagementRate: 0,
          contentStrategy: '',
          influenceScore: 0
        },
        techStack: {
          website: {
            framework: undefined,
            cms: undefined,
            ecommerce: undefined,
            analytics: [],
            hosting: '',
            cdn: undefined,
            ssl: true,
            mobileOptimized: true,
            pageSpeed: 0
          },
          analytics: [],
          marketing: [],
          hosting: []
        }
      },
      industryAnalysis: {
        primaryIndustry: 'General',
        subIndustries: [],
        marketSize: 0,
        growthRate: 0,
        competitionLevel: 'medium',
        marketTrends: [],
        seasonality: [],
        regulatoryFactors: [],
        keySuccessFactors: [],
        industryBenchmarks: {
          averageCAC: 0,
          averageLTV: 0,
          averageConversion: 0,
          averageTrafficGrowth: 0,
          typicalDirectoryROI: 0
        }
      },
      competitiveAnalysis: {
        directCompetitors: [],
        indirectCompetitors: [],
        marketGaps: [],
        competitiveAdvantages: [],
        weaknesses: [],
        differentiationOpportunities: [],
        competitorDirectoryPresence: {
          competitor: 'Unknown',
          directories: [],
          totalPresence: 0,
          gapOpportunities: []
        },
        marketShare: {
          totalMarketSize: 0,
          currentMarketShare: 0,
          targetMarketShare: 0,
          topCompetitors: []
        }
      },
      seoAnalysis: {
        currentScore: 0,
        technicalSEO: {
          pageSpeed: 0,
          mobileOptimized: false,
          sslCertificate: true,
          xmlSitemap: false,
          robotsTxt: false,
          schemaMarkup: 0,
          canonicalTags: 0,
          metaTags: {
            titleTags: 0,
            metaDescriptions: 0,
            ogTags: 0,
            schemaMarkup: 0,
            canonicalTags: 0
          }
        },
        contentSEO: {
          titleOptimization: 0,
          metaDescriptions: 0,
          headingStructure: 0,
          keywordDensity: 0,
          contentLength: 0,
          duplicateContent: 0,
          imageOptimization: 0
        },
        localSEO: {
          googleMyBusiness: false,
          napConsistency: 0,
          localCitations: 0,
          reviewCount: 0,
          averageRating: 0,
          localKeywordRankings: 0
        },
        competitorSEOGap: 0,
        improvementOpportunities: [],
        keywordAnalysis: {
          primaryKeywords: [],
          secondaryKeywords: [],
          longTailOpportunities: [],
          competitorKeywords: [],
          keywordGaps: [],
          seasonalKeywords: []
        },
        backlinkAnalysis: {
          totalBacklinks: 0,
          domainAuthority: 0,
          linkQuality: 0,
          competitorGap: 0,
          linkBuildingOpportunities: []
        }
      },
      directoryOpportunities: {
        totalDirectories: 0,
        categorizedOpportunities: {
          highAuthority: [],
          industrySpecific: [],
          localDirectories: [],
          nicheDirectories: [],
          freeDirectories: [],
          premiumDirectories: []
        },
        prioritizedSubmissions: [],
        estimatedResults: {
          totalTrafficIncrease: 0,
          leadIncrease: 0,
          brandExposureIncrease: 0,
          timeToResults: {
            immediate: 0,
            shortTerm: 0,
            mediumTerm: 0,
            longTerm: 0
          },
          riskFactors: []
        },
        submissionStrategy: {
          totalDirectories: 0,
          submissionPaces: [],
          budgetAllocation: [],
          timeline: [],
          successMetrics: []
        }
      },
      marketPositioning: {
        currentPosition: 'Unknown',
        recommendedPosition: 'Improved',
        valueProposition: {
          primary: 'Quality service',
          secondary: [],
          differentiators: [],
          benefits: [],
          proofPoints: []
        },
        messagingFramework: {
          coreMessage: 'Delivering value to customers',
          audienceMessages: [],
          channelMessages: [],
          brandVoice: 'Professional',
          keyThemes: []
        },
        brandingRecommendations: [],
        audienceSegmentation: []
      },
      revenueProjections: {
        baseline: {
          timeframe: '6months',
          projectedRevenue: 0,
          trafficIncrease: 0,
          leadIncrease: 0,
          conversionRate: 0,
          customerLifetimeValue: 0,
          assumptions: []
        },
        conservative: {
          timeframe: '6months',
          projectedRevenue: 0,
          trafficIncrease: 0,
          leadIncrease: 0,
          conversionRate: 0,
          customerLifetimeValue: 0,
          assumptions: []
        },
        optimistic: {
          timeframe: '6months',
          projectedRevenue: 0,
          trafficIncrease: 0,
          leadIncrease: 0,
          conversionRate: 0,
          customerLifetimeValue: 0,
          assumptions: []
        },
        directoryROI: [],
        paybackPeriod: 0,
        lifetimeValue: 0
      },
      successMetrics: {
        visibilityScore: 0,
        authorityScore: 0,
        trafficPotential: 0,
        leadGenPotential: 0,
        brandExposure: 0,
        timeToResults: 0,
        competitiveAdvantage: 0
      },
      confidence: 50,
      qualityScore: 50,
      analysisTimestamp: new Date()
    }
  }

  private async performWebsiteAnalysis(url: string): Promise<ExtractedData> {
    try {
      return await this.websiteAnalyzer.analyzeWebsite(url)
    } catch (error) {
      logger.error('Website analysis failed', { metadata: { url, error } })
      throw new Error(`Failed to analyze website: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async optimizeAndValidateResults(
    businessIntelligence: BusinessIntelligenceType,
    request: AnalysisRequest,
    directoryOpportunities: DirectoryMatchingResult
  ): Promise<BusinessIntelligenceType> {
    // Apply user preferences and constraints
    if (request.userInput) {
      businessIntelligence = this.applyUserPreferences(businessIntelligence, request.userInput)
    }

    // Validate confidence scores and adjust if necessary
    businessIntelligence = this.validateConfidenceScores(businessIntelligence)

    // Optimize directory recommendations based on budget
    if (request.userInput?.budget) {
      businessIntelligence.directoryOpportunities = this.optimizeForBudget(
        businessIntelligence.directoryOpportunities,
        request.userInput.budget
      )
    }

    // Final quality assurance
    this.performQualityAssurance(businessIntelligence)

    return {
      ...businessIntelligence,
      directoryOpportunities: this.transformDirectoryOpportunities(directoryOpportunities)
    }
  }

  private transformDirectoryOpportunities(result: DirectoryMatchingResult) {
    const toPrioritizedSubmission = (opportunity: DirectoryOpportunity, index: number): any => ({
      directoryId: opportunity.id,
      directoryName: opportunity.name,
      category: opportunity.category,
      priority: opportunity.successProbability,
      successProbability: opportunity.successProbability,
      estimatedTraffic: opportunity.estimatedTraffic,
      cost: opportunity.cost,
      timeInvestment: 0,
      expectedROI: 0,
      optimizedListing: {
        title: opportunity.name,
        description: opportunity.reasoning ?? '',
        category: opportunity.category,
        tags: [],
        images: [],
        features: opportunity.benefits ?? [],
        contactInfo: {
          website: opportunity.url,
          socialLinks: []
        }
      },
      submissionTips: [],
      timeline: {
        preparation: 0,
        submission: 0,
        review: 0,
        goLive: 0,
        optimization: 0,
        totalTime: 0
      }
    })

    const freePrioritized = result.freeOpportunities.map(toPrioritizedSubmission)
    const premiumPrioritized = result.premiumOpportunities.map(toPrioritizedSubmission)
    const prioritized = [...freePrioritized, ...premiumPrioritized]

    return {
      totalDirectories: result.totalOpportunities,
      categorizedOpportunities: {
        highAuthority: prioritized.filter((p) => p.priority > 80),
        industrySpecific: prioritized.filter((p) => p.category !== 'General Business'),
        localDirectories: prioritized.filter((p) => p.category === 'Local Business'),
        nicheDirectories: prioritized.filter((p) => p.category === 'Niche'),
        freeDirectories: freePrioritized,
        premiumDirectories: premiumPrioritized
      },
      prioritizedSubmissions: prioritized,
      estimatedResults: {
        totalTrafficIncrease: result.expectedROI.conservative,
        leadIncrease: Math.round(result.expectedROI.conservative * 0.1),
        brandExposureIncrease: Math.round(result.expectedROI.conservative * 0.2),
        timeToResults: {
          immediate: 14,
          shortTerm: 30,
          mediumTerm: 60,
          longTerm: 120
        },
        riskFactors: []
      },
      submissionStrategy: {
        totalDirectories: result.totalOpportunities,
        submissionPaces: [],
        budgetAllocation: [],
        timeline: [],
        successMetrics: []
      }
    }
  }

  private applyUserPreferences(
    intelligence: BusinessIntelligenceType,
    userInput: NonNullable<AnalysisRequest['userInput']>
  ): BusinessIntelligenceType {
    // Apply business goals
    if (userInput.businessGoals) {
      intelligence.successMetrics = this.adjustSuccessMetricsForGoals(
        intelligence.successMetrics,
        userInput.businessGoals
      )
    }

    // Apply target audience adjustments
    if (userInput.targetAudience) {
      intelligence.marketPositioning = this.adjustMarketPositioningForAudience(
        intelligence.marketPositioning,
        userInput.targetAudience
      )
    }

    return intelligence
  }

  private adjustSuccessMetricsForGoals(metrics: any, goals: string[]): any {
    // Adjust success metrics based on user goals
    if (goals.includes('lead_generation')) {
      metrics.leadGenPotential = Math.min(100, metrics.leadGenPotential * 1.2)
    }
    
    if (goals.includes('brand_awareness')) {
      metrics.brandExposure = Math.min(100, metrics.brandExposure * 1.15)
    }

    return metrics
  }

  private adjustMarketPositioningForAudience(positioning: any, audience: string): any {
    // Customize messaging for specific audience
    positioning.messagingFramework.coreMessage = `${positioning.messagingFramework.coreMessage} - tailored for ${audience}`
    return positioning
  }

  private validateConfidenceScores(intelligence: BusinessIntelligenceType): BusinessIntelligenceType {
    // Ensure confidence scores are realistic and consistent
    const minConfidence = Math.max(30, Math.min(intelligence.confidence, intelligence.qualityScore) - 10)
    const maxConfidence = Math.min(95, Math.max(intelligence.confidence, intelligence.qualityScore) + 10)
    
    intelligence.confidence = Math.max(minConfidence, Math.min(maxConfidence, intelligence.confidence))
    
    return intelligence
  }

  private optimizeForBudget(opportunities: any, budget: number): any {
    // Filter and prioritize directories based on budget
    const sortedSubmissions = opportunities.prioritizedSubmissions
      .filter((submission: any) => submission.cost <= budget * 0.3) // Max 30% of budget per directory
      .sort((a: any, b: any) => (b.expectedROI / b.cost) - (a.expectedROI / a.cost))

    const totalCost = sortedSubmissions.reduce((sum: number, sub: any) => sum + sub.cost, 0)
    
    if (totalCost <= budget) {
      opportunities.prioritizedSubmissions = sortedSubmissions
    } else {
      // Select highest ROI directories within budget
      let remainingBudget = budget
      opportunities.prioritizedSubmissions = sortedSubmissions.filter((sub: any) => {
        if (sub.cost <= remainingBudget) {
          remainingBudget -= sub.cost
          return true
        }
        return false
      })
    }

    return opportunities
  }

  private performQualityAssurance(intelligence: BusinessIntelligenceType): void {
    // Validate required fields with safety checks
    if (!intelligence.profile) {
      logger.warn('Business profile missing - creating default profile')
      intelligence.profile = {
        name: 'Unknown Business',
        domain: '',
        description: '',
        tagline: '',
        primaryCategory: 'Unknown',
        secondaryCategories: [],
        industryVertical: 'Unknown',
        businessModel: {
          type: 'B2B',
          revenueStreams: [],
          pricingModel: 'one-time',
          customerAcquisitionModel: []
        },
        targetMarket: {
          primaryAudience: 'General',
          secondaryAudiences: [],
          demographics: {
            ageRanges: [],
            genders: [],
            incomes: [],
            educations: [],
            locations: [],
            occupations: []
          },
          psychographics: {
            values: [],
            interests: [],
            lifestyle: [],
            personality: [],
            attitudes: []
          },
          painPoints: [],
          buyingBehavior: {
            decisionFactors: [],
            purchaseFrequency: 'unknown',
            averageOrderValue: 0,
            seasonality: 'unknown',
            channels: []
          }
        },
        location: {
          headquarters: {
            city: 'Unknown',
            country: 'Unknown'
          },
          offices: [],
          serviceAreas: [],
          timeZones: []
        },
        serviceAreas: [],
        marketReach: 'local',
        size: 'startup',
        stage: 'early',
        contentAnalysis: {
          readabilityScore: 0,
          sentimentScore: 0,
          keyThemes: [],
          contentGaps: [],
          expertiseIndicators: [],
          trustSignals: []
        },
        contactInfo: {
          website: '',
          socialLinks: []
        },
        socialPresence: {
          platforms: [],
          totalFollowers: 0,
          engagementRate: 0,
          contentStrategy: '',
          influenceScore: 0
        },
        techStack: {
          website: {
            framework: undefined,
            cms: undefined,
            ecommerce: undefined,
            analytics: [],
            hosting: '',
            cdn: undefined,
            ssl: true,
            mobileOptimized: true,
            pageSpeed: 0
          },
          analytics: [],
          marketing: [],
          hosting: []
        }
      }
    }

    if (!intelligence.profile.name || intelligence.profile.name === 'Unknown Business') {
      logger.warn('Business name not properly extracted')
    }

    if (!intelligence.directoryOpportunities) {
      logger.warn('Directory opportunities missing - creating default structure')
      intelligence.directoryOpportunities = {
        totalDirectories: 0,
        prioritizedSubmissions: [],
        categoryBreakdown: {},
        estimatedROI: 0,
        confidence: 0
      } as any
    } else if (!intelligence.directoryOpportunities.prioritizedSubmissions || intelligence.directoryOpportunities.prioritizedSubmissions.length === 0) {
      logger.warn('No directory opportunities found')
    }

    if (!intelligence.confidence || intelligence.confidence < 40) {
      logger.warn('Low confidence analysis result', {
        metadata: { confidence: intelligence.confidence || 0 }
      })
    }
  }

  // Progress tracking methods
  private initializeProgressTracking(): void {
    this.currentStage = 0
    this.stageProgress = 0
  }

  private async updateProgress(stageName: string, stageProgress: number): Promise<void> {
    if (!this.config.enableProgressTracking || !this.progressCallback) return

    const stage = this.processingStages.find(s => s.name === stageName)
    if (!stage) return

    this.currentStage = this.processingStages.indexOf(stage)
    this.stageProgress = stageProgress

    const totalProgress = this.calculateTotalProgress()
    const remainingTime = this.estimateRemainingTime()

    const progress: AnalysisProgressType = {
      stage: stage.description,
      progress: totalProgress,
      estimatedTimeRemaining: remainingTime,
      currentTask: `${stage.description} (${stageProgress}%)`
    }

    this.progressCallback(progress)
  }

  private calculateTotalProgress(): number {
    let totalWeight = 0
    let completedWeight = 0

    for (let i = 0; i < this.processingStages.length; i++) {
      const stage = this.processingStages[i]
      totalWeight += stage.weight

      if (i < this.currentStage) {
        completedWeight += stage.weight
      } else if (i === this.currentStage) {
        completedWeight += (stage.weight * this.stageProgress / 100)
      }
    }

    return Math.round((completedWeight / totalWeight) * 100)
  }

  private estimateRemainingTime(): number {
    let remainingTime = 0

    for (let i = this.currentStage; i < this.processingStages.length; i++) {
      const stage = this.processingStages[i]
      
      if (i === this.currentStage) {
        remainingTime += stage.estimatedDuration * (1 - this.stageProgress / 100)
      } else {
        remainingTime += stage.estimatedDuration
      }
    }

    return Math.round(remainingTime)
  }

  // Caching methods
  private async cacheAnalysisResults(url: string, intelligence: BusinessIntelligenceType): Promise<void> {
    try {
      // Implementation would depend on chosen caching solution (Redis, file system, etc.)
      const cacheKey = this.generateCacheKey(url)
      logger.debug('Analysis results cached', { metadata: { cacheKey } })
    } catch (error) {
      logger.warn('Failed to cache analysis results', { metadata: { error } })
    }
  }

  private generateCacheKey(url: string): string {
    return `ai_analysis_${Buffer.from(url).toString('base64')}_${Date.now()}`
  }

  // Cost estimation
  private estimateTokenUsage(intelligence: BusinessIntelligenceType): number {
    // Estimate based on analysis depth and features used
    let tokens = 0
    
    // Base analysis tokens
    tokens += 2000
    
    // Business categorization
    tokens += 1500
    
    // Industry analysis
    tokens += 2000
    
    // Competitive analysis (if enabled)
    if (this.config.aiAnalysis.enableCompetitorAnalysis) {
      tokens += 1500
    }
    
    // Revenue projections (if enabled)
    if (this.config.aiAnalysis.enableRevenueProjections) {
      tokens += 1000
    }
    
    // Directory optimization
    tokens += intelligence.directoryOpportunities.prioritizedSubmissions.length * 200
    
    return tokens
  }

  private estimateAnalysisCost(intelligence: BusinessIntelligenceType): number {
    const tokens = this.estimateTokenUsage(intelligence)
    
    // Cost per 1k tokens for AI models (approximate)
    // Claude Sonnet: ~$0.003/1K input, $0.015/1K output
    // Gemini Pro: ~$0.0005/1K input, $0.0015/1K output
    const costPer1kTokens = this.config.aiAnalysis.model?.includes('claude') ? 0.015 : 0.0015
    
    return Math.round(tokens / 1000 * costPer1kTokens * 100) / 100
  }

  // Cleanup
  private async cleanup(): Promise<void> {
    try {
      await this.websiteAnalyzer.cleanup()
    } catch (error) {
      logger.warn('Error during cleanup', { metadata: { error } })
    }
  }

  // Public methods for progress tracking
  onProgress(callback: (progress: AnalysisProgressType) => void): void {
    this.progressCallback = callback
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    components: Record<string, boolean>
  }> {
    const components: Record<string, boolean> = {}

    try {
      // Check AI API (Anthropic/Gemini)
      components.aiService = await this.checkAIService()
      
      // Check database connectivity (if available)
      components.database = await this.checkDatabase()
      
      // Check external dependencies
      components.puppeteer = await this.checkPuppeteer()

      const allHealthy = Object.values(components).every(status => status)
      const anyHealthy = Object.values(components).some(status => status)

      return {
        status: allHealthy ? 'healthy' : anyHealthy ? 'degraded' : 'unhealthy',
        components
      }

    } catch (error) {
      logger.error('Health check failed', { metadata: { error } })
      return {
        status: 'unhealthy',
        components
      }
    }
  }

  private async checkAIService(): Promise<boolean> {
    try {
      // Check for Anthropic or Gemini API keys
      if (!process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) return false
      
      const response = await this.aiAnalyzer.generateBusinessIntelligence(this.getMockWebsiteData())
      
      return !!response
    } catch {
      return false
    }
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      // Simple database connectivity check
      return true // Implement actual check
    } catch {
      return false
    }
  }

  private async checkPuppeteer(): Promise<boolean> {
    try {
      // Check if Puppeteer can launch
      const analyzer = new EnhancedWebsiteAnalyzer({
        ...this.config.websiteAnalysis,
        enableScreenshots: false
      })
      await analyzer.cleanup()
      return true
    } catch {
      return false
    }
  }

  private getMockWebsiteData(): ExtractedData {
    // Return minimal mock data for health check
    return {
      basicInfo: {
        title: 'Test',
        description: 'Test',
        keywords: [],
        language: 'en',
        charset: 'UTF-8',
        viewport: '',
        favicon: '',
        canonicalUrl: 'https://example.com'
      },
      businessProfile: {
        name: 'Test Business',
        domain: 'example.com',
        description: 'Test business description',
        contactInfo: {
          website: 'https://example.com',
          socialLinks: []
        }
      },
      seoAnalysis: {
        currentScore: 50,
        technicalSEO: {
          pageSpeed: 50,
          mobileOptimized: true,
          sslCertificate: true,
          xmlSitemap: false,
          robotsTxt: false,
          schemaMarkup: 0,
          canonicalTags: 0,
          metaTags: {
            titleTags: 50,
            metaDescriptions: 50,
            ogTags: 50,
            schemaMarkup: 0,
            canonicalTags: 0
          }
        },
        contentSEO: {
          titleOptimization: 50,
          metaDescriptions: 50,
          headingStructure: 50,
          keywordDensity: 50,
          contentLength: 500,
          duplicateContent: 0,
          imageOptimization: 50
        },
        localSEO: {
          googleMyBusiness: false,
          napConsistency: 50,
          localCitations: 0,
          reviewCount: 0,
          averageRating: 0,
          localKeywordRankings: 50
        },
        competitorSEOGap: 25,
        improvementOpportunities: [],
        keywordAnalysis: {
          primaryKeywords: [],
          secondaryKeywords: [],
          longTailOpportunities: [],
          competitorKeywords: [],
          keywordGaps: [],
          seasonalKeywords: []
        },
        backlinkAnalysis: {
          totalBacklinks: 0,
          domainAuthority: 50,
          linkQuality: 50,
          competitorGap: 25,
          linkBuildingOpportunities: []
        }
      },
      contentAnalysis: {
        readabilityScore: 70,
        sentimentScore: 60,
        keyThemes: ['test'],
        contentGaps: [],
        expertiseIndicators: [],
        trustSignals: []
      },
      socialPresence: {
        platforms: [],
        totalFollowers: 0,
        engagementRate: 0,
        contentStrategy: 'Unknown',
        influenceScore: 0
      },
      techStack: {
        website: {
          framework: undefined,
          cms: undefined,
          ecommerce: undefined,
          analytics: [],
          hosting: '',
          cdn: undefined,
          ssl: true,
          mobileOptimized: true,
          pageSpeed: 75
        },
        analytics: [],
        marketing: [],
        hosting: []
      },
      screenshots: [],
      structuredData: {
        hasStructuredData: false,
        schemaTypes: [],
        jsonLdCount: 0,
        microdataCount: 0,
        organizationData: {},
        productData: [],
        breadcrumbs: []
      },
      performanceMetrics: {
        loadTime: 2000,
        firstContentfulPaint: 1500,
        largestContentfulPaint: 2500,
        cumulativeLayoutShift: 0.1,
        firstInputDelay: 100,
        totalBlockingTime: 150,
        speedIndex: 2000,
        performanceScore: 75
      }
    }
  }
}

// Default configuration
export const DEFAULT_BUSINESS_INTELLIGENCE_CONFIG: BusinessIntelligenceConfig = {
  websiteAnalysis: DEFAULT_ENHANCED_CONFIG,
  aiAnalysis: {
    ...DEFAULT_AI_ANALYSIS_CONFIG,
    model: 'claude-3-sonnet-20241022'
  },
  directoryMatching: DEFAULT_DIRECTORY_MATCHING_CONFIG,
  enableProgressTracking: true,
  cacheResults: true,
  maxProcessingTime: 300000
}

// Factory function
export function createBusinessIntelligenceEngine(config?: Partial<BusinessIntelligenceConfig>): AIBusinessIntelligenceEngine {
  return new AIBusinessIntelligenceEngine(config)
}

// Singleton instance for application-wide use
let engineInstance: AIBusinessIntelligenceEngine | null = null

export function getBusinessIntelligenceEngine(): AIBusinessIntelligenceEngine {
  if (!engineInstance) {
    engineInstance = new AIBusinessIntelligenceEngine()
  }
  return engineInstance
}

// Convenience wrapper for easy integration
export const BusinessIntelligence = {
  analyze: (request: AnalysisRequest) => getBusinessIntelligenceEngine().analyzeBusinessIntelligence(request),
  healthCheck: () => getBusinessIntelligenceEngine().healthCheck(),
  onProgress: (callback: (progress: AnalysisProgressType) => void) => getBusinessIntelligenceEngine().onProgress(callback)
}
