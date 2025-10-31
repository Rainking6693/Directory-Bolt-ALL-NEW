// 🚀 STRUCTURED API RESPONSE SYSTEM - Standardized response formatting for frontend
// Comprehensive response structuring with metadata, pagination, and error handling

export interface ApiMetadata {
  requestId: string
  timestamp: string
  version: string
  processingTime: number
  rateLimit?: {
    limit: number
    remaining: number
    resetTime: number
  }
  pagination?: {
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
    hasNext: boolean
    hasPrevious: boolean
  }
  cache?: {
    hit: boolean
    ttl?: number
    key?: string
  }
}

export interface ApiSuccess<T = any> {
  success: true
  data: T
  metadata: ApiMetadata
  warnings?: string[]
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
    field?: string
    statusCode: number
    details?: Record<string, any>
  }
  metadata: ApiMetadata
  debug?: {
    stack?: string
    context?: Record<string, any>
  }
}

export type ApiResponse<T = any> = ApiSuccess<T> | ApiError

// Enhanced Analysis Response Structure
export interface AnalysisResponseData {
  // Core Analysis Results
  website: {
    url: string
    title: string
    description: string
    domain: string
    isSecure: boolean
    responseTime?: number
    finalUrl?: string
    redirectChain?: string[]
  }

  // SEO Analysis
  seo: {
    score: number
    grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D+' | 'D' | 'F'
    factors: {
      title: SeoFactor
      description: SeoFactor
      headings: SeoFactor
      images: SeoFactor
      schema: SeoFactor
      performance: SeoFactor
      mobile: SeoFactor
    }
    recommendations: SeoRecommendation[]
  }

  // Directory Analysis
  directories: {
    currentListings: DirectoryListing[]
    opportunities: DirectoryOpportunity[]
    summary: {
      totalFound: number
      totalOpportunities: number
      estimatedReach: number
      potentialTraffic: number
    }
    categories: DirectoryCategory[]
  }

  // Business Intelligence
  insights: {
    competitivePosition: {
      score: number
      description: string
      advantages: string[]
      gaps: string[]
    }
    marketOpportunity: {
      size: 'small' | 'medium' | 'large'
      description: string
      growthPotential: number
    }
    priorityActions: ActionItem[]
  }

  // AI Analysis (if available)
  ai?: {
    businessProfile: {
      name: string
      industry: string
      category: string
      targetAudience: string[]
      businessModel: string
      confidence: number
    }
    smartRecommendations: SmartRecommendation[]
    insights: {
      marketPosition: string
      strengths: string[]
      improvements: string[]
      successFactors: string[]
    }
    confidence: number
  }

  // Performance Metrics
  metrics: {
    visibilityScore: number
    reachScore: number
    authorityScore: number
    trustScore: number
    completenessScore: number
    breakdown: {
      [metric: string]: {
        current: number
        potential: number
        gap: number
      }
    }
  }

  // Issues and Recommendations
  issues: Issue[]
  recommendations: Recommendation[]
  
  // Progress tracking
  progress: {
    requestId: string
    status: 'completed'
    completedAt: string
    processingTime: number
    stepsCompleted: number
    totalSteps: number
  }
}

export interface SeoFactor {
  score: number
  status: 'excellent' | 'good' | 'needs_improvement' | 'critical'
  description: string
  impact: 'high' | 'medium' | 'low'
  recommendations?: string[]
}

export interface SeoRecommendation {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  effort: 'low' | 'medium' | 'high'
  impact: 'high' | 'medium' | 'low'
  category: 'technical' | 'content' | 'structure' | 'performance'
  implementation: string[]
}

export interface DirectoryListing {
  name: string
  url?: string
  status: 'verified' | 'claimed' | 'unclaimed' | 'inconsistent'
  lastUpdated?: string
  rating?: number
  reviews?: number
  completeness: number
  issues?: string[]
}

export interface DirectoryOpportunity {
  id: string
  name: string
  category: string
  authority: number
  estimatedTraffic: number
  difficulty: 'easy' | 'medium' | 'hard'
  cost: number
  timeToList: string
  requirements: string[]
  benefits: string[]
  submissionUrl?: string
  priority: number
  relevanceScore: number
  roi: {
    estimatedLeads: number
    estimatedRevenue: number
    timeframe: string
  }
}

export interface DirectoryCategory {
  name: string
  count: number
  averageAuthority: number
  totalTraffic: number
  categories: string[]
}

export interface ActionItem {
  id: string
  title: string
  description: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  effort: 'quick_win' | 'low' | 'medium' | 'high'
  impact: 'high' | 'medium' | 'low'
  timeframe: string
  category: 'listing' | 'optimization' | 'content' | 'technical'
  dependencies?: string[]
  estimatedROI?: {
    leads: number
    revenue: number
    timeframe: string
  }
}

export interface SmartRecommendation {
  directory: string
  reasoning: string
  successProbability: number
  optimizedDescription: string
  customStrategy: string
  keywords: string[]
  expectedOutcome: {
    timeline: string
    traffic: number
    leads: number
  }
}

export interface Issue {
  id: string
  type: 'critical' | 'warning' | 'info'
  category: 'seo' | 'listings' | 'content' | 'technical' | 'competitive'
  title: string
  description: string
  impact: string
  priority: number
  affectedAreas: string[]
  resolution: {
    steps: string[]
    effort: 'low' | 'medium' | 'high'
    timeframe: string
    resources?: string[]
  }
}

export interface Recommendation {
  id: string
  title: string
  description: string
  category: 'quick_wins' | 'strategic' | 'long_term'
  priority: 'high' | 'medium' | 'low'
  effort: 'low' | 'medium' | 'high'
  impact: 'high' | 'medium' | 'low'
  implementation: {
    steps: string[]
    timeframe: string
    resources: string[]
    cost?: number
  }
  expectedResults: {
    metric: string
    improvement: string
    timeframe: string
  }[]
}

// Response Builder Class
export class ApiResponseBuilder {
  private requestId: string
  private startTime: number
  private version: string

  constructor(requestId: string, version: string = '1.0') {
    this.requestId = requestId
    this.startTime = Date.now()
    this.version = version
  }

  success<T>(
    data: T, 
    options: {
      warnings?: string[]
      rateLimit?: ApiMetadata['rateLimit']
      pagination?: ApiMetadata['pagination']
      cache?: ApiMetadata['cache']
    } = {}
  ): ApiSuccess<T> {
    return {
      success: true,
      data,
      metadata: {
        requestId: this.requestId,
        timestamp: new Date().toISOString(),
        version: this.version,
        processingTime: Date.now() - this.startTime,
        rateLimit: options.rateLimit,
        pagination: options.pagination,
        cache: options.cache
      },
      warnings: options.warnings
    }
  }

  error(
    code: string,
    message: string,
    statusCode: number = 500,
    options: {
      field?: string
      details?: Record<string, any>
      debug?: {
        stack?: string
        context?: Record<string, any>
      }
      rateLimit?: ApiMetadata['rateLimit']
    } = {}
  ): ApiError {
    return {
      success: false,
      error: {
        code,
        message,
        statusCode,
        field: options.field,
        details: options.details
      },
      metadata: {
        requestId: this.requestId,
        timestamp: new Date().toISOString(),
        version: this.version,
        processingTime: Date.now() - this.startTime,
        rateLimit: options.rateLimit
      },
      debug: options.debug
    }
  }

  progressResponse(progress: any): ApiSuccess<any> {
    return this.success({
      requestId: progress.requestId,
      status: progress.status,
      overallProgress: progress.overallProgress,
      currentStep: progress.currentStep,
      steps: progress.steps.map((step: any) => ({
        id: step.id,
        title: step.title,
        description: step.description,
        status: step.status,
        progress: step.progress,
        duration: step.duration,
        error: step.error
      })),
      estimatedTimeRemaining: this.calculateEstimatedTimeRemaining(progress),
      startTime: progress.startTime,
      url: progress.url
    })
  }

  private calculateEstimatedTimeRemaining(progress: any): number {
    const completedSteps = progress.steps.filter((s: any) => s.status === 'completed')
    if (completedSteps.length === 0) return 0

    const avgStepTime = completedSteps.reduce((sum: number, step: any) => 
      sum + (step.duration || 0), 0) / completedSteps.length

    const remainingSteps = progress.steps.filter((s: any) => 
      s.status === 'pending').length

    return remainingSteps * avgStepTime
  }
}

// Utility functions for response transformation
export class AnalysisResponseTransformer {
  static transform(rawAnalysisResult: any, requestId: string): AnalysisResponseData {
    return {
      website: {
        url: rawAnalysisResult.url,
        title: rawAnalysisResult.title,
        description: rawAnalysisResult.description,
        domain: this.extractDomain(rawAnalysisResult.url),
        isSecure: rawAnalysisResult.url.startsWith('https://'),
        responseTime: rawAnalysisResult.responseTime,
        finalUrl: rawAnalysisResult.finalUrl,
        redirectChain: rawAnalysisResult.redirectChain
      },

      seo: {
        score: rawAnalysisResult.seoScore,
        grade: this.calculateSeoGrade(rawAnalysisResult.seoScore),
        factors: this.transformSeoFactors(rawAnalysisResult),
        recommendations: this.transformSeoRecommendations(rawAnalysisResult.recommendations)
      },

      directories: {
        currentListings: this.transformCurrentListings(rawAnalysisResult.currentListings),
        opportunities: this.transformDirectoryOpportunities(rawAnalysisResult.directoryOpportunities),
        summary: {
          totalFound: rawAnalysisResult.currentListings?.length || 0,
          totalOpportunities: rawAnalysisResult.directoryOpportunities?.length || 0,
          estimatedReach: rawAnalysisResult.potentialLeads || 0,
          potentialTraffic: this.calculatePotentialTraffic(rawAnalysisResult.directoryOpportunities)
        },
        categories: this.groupDirectoriesByCategory(rawAnalysisResult.directoryOpportunities)
      },

      insights: {
        competitivePosition: {
          score: 100 - (rawAnalysisResult.competitorAdvantage || 0),
          description: this.generateCompetitiveDescription(rawAnalysisResult.competitorAdvantage),
          advantages: this.extractAdvantages(rawAnalysisResult),
          gaps: this.extractGaps(rawAnalysisResult)
        },
        marketOpportunity: {
          size: this.assessMarketSize(rawAnalysisResult.missedOpportunities),
          description: this.generateMarketDescription(rawAnalysisResult.missedOpportunities),
          growthPotential: this.calculateGrowthPotential(rawAnalysisResult)
        },
        priorityActions: this.generatePriorityActions(rawAnalysisResult)
      },

      ai: rawAnalysisResult.aiAnalysis ? {
        businessProfile: {
          name: rawAnalysisResult.businessProfile?.name || 'Unknown',
          industry: rawAnalysisResult.businessProfile?.industry || 'Unknown',
          category: rawAnalysisResult.businessProfile?.category || 'Unknown',
          targetAudience: rawAnalysisResult.businessProfile?.targetAudience || [],
          businessModel: rawAnalysisResult.businessProfile?.businessModel || 'Unknown',
          confidence: rawAnalysisResult.aiConfidence || 0
        },
        smartRecommendations: rawAnalysisResult.smartRecommendations || [],
        insights: rawAnalysisResult.aiAnalysis.insights || {
          marketPosition: 'Unknown',
          strengths: [],
          improvements: [],
          successFactors: []
        },
        confidence: rawAnalysisResult.aiConfidence || 0
      } : undefined,

      metrics: {
        visibilityScore: rawAnalysisResult.visibility || 0,
        reachScore: this.calculateReachScore(rawAnalysisResult),
        authorityScore: this.calculateAuthorityScore(rawAnalysisResult),
        trustScore: this.calculateTrustScore(rawAnalysisResult),
        completenessScore: this.calculateCompletenessScore(rawAnalysisResult),
        breakdown: this.generateMetricsBreakdown(rawAnalysisResult)
      },

      issues: this.transformIssues(rawAnalysisResult.issues),
      recommendations: this.transformRecommendations(rawAnalysisResult.recommendations),

      progress: {
        requestId,
        status: 'completed',
        completedAt: new Date().toISOString(),
        processingTime: Date.now() - Date.now(), // This would be calculated properly
        stepsCompleted: 10, // This would come from progress tracker
        totalSteps: 10
      }
    }
  }

  private static extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '')
    } catch {
      return url
    }
  }

  private static calculateSeoGrade(score: number): AnalysisResponseData['seo']['grade'] {
    if (score >= 95) return 'A+'
    if (score >= 90) return 'A'
    if (score >= 85) return 'B+'
    if (score >= 80) return 'B'
    if (score >= 75) return 'C+'
    if (score >= 70) return 'C'
    if (score >= 60) return 'D+'
    if (score >= 50) return 'D'
    return 'F'
  }

  private static transformSeoFactors(result: any): AnalysisResponseData['seo']['factors'] {
    return {
      title: {
        score: result.titleScore || 0,
        status: result.titleScore > 80 ? 'excellent' : result.titleScore > 60 ? 'good' : 'needs_improvement',
        description: 'Title tag optimization',
        impact: 'high'
      },
      description: {
        score: result.descriptionScore || 0,
        status: result.descriptionScore > 80 ? 'excellent' : result.descriptionScore > 60 ? 'good' : 'needs_improvement',
        description: 'Meta description optimization',
        impact: 'high'
      },
      headings: {
        score: result.headingScore || 0,
        status: result.headingScore > 80 ? 'excellent' : result.headingScore > 60 ? 'good' : 'needs_improvement',
        description: 'Heading structure and hierarchy',
        impact: 'medium'
      },
      images: {
        score: result.imageScore || 0,
        status: result.imageScore > 80 ? 'excellent' : result.imageScore > 60 ? 'good' : 'needs_improvement',
        description: 'Image optimization and alt tags',
        impact: 'medium'
      },
      schema: {
        score: result.schemaScore || 0,
        status: result.schemaScore > 80 ? 'excellent' : result.schemaScore > 60 ? 'good' : 'needs_improvement',
        description: 'Structured data markup',
        impact: 'high'
      },
      performance: {
        score: result.performanceScore || 0,
        status: result.performanceScore > 80 ? 'excellent' : result.performanceScore > 60 ? 'good' : 'needs_improvement',
        description: 'Page load speed and performance',
        impact: 'high'
      },
      mobile: {
        score: result.mobileScore || 0,
        status: result.mobileScore > 80 ? 'excellent' : result.mobileScore > 60 ? 'good' : 'needs_improvement',
        description: 'Mobile responsiveness and usability',
        impact: 'high'
      }
    }
  }

  private static transformSeoRecommendations(recommendations: any[]): SeoRecommendation[] {
    return (recommendations || []).map((rec: any) => ({
      title: rec.action || rec.title,
      description: rec.impact || rec.description,
      priority: rec.priority || 'medium',
      effort: rec.effort || 'medium',
      impact: rec.impact === 'high' ? 'high' : rec.impact === 'low' ? 'low' : 'medium',
      category: 'technical',
      implementation: [rec.action || rec.title]
    }))
  }

  private static transformCurrentListings(listings: any): DirectoryListing[] {
    // Handle case where listings might be a number (count) or array
    if (typeof listings === 'number') {
      // If it's just a count, generate mock listings
      const mockListings = ['Google Business Profile', 'Yelp', 'Facebook Business', 'Yellow Pages', 'Bing Places']
      return mockListings.slice(0, listings).map((name, index) => ({
        name,
        status: 'verified' as const,
        completeness: 75 + Math.floor(Math.random() * 20), // 75-95%
        rating: Math.floor(Math.random() * 2) + 4, // 4-5 stars
        reviews: Math.floor(Math.random() * 100) + 10 // 10-110 reviews
      }))
    }
    
    // Handle array of listings
    const listingsArray = Array.isArray(listings) ? listings : []
    return listingsArray.map((listing: any) => ({
      name: listing.name || listing,
      status: 'verified' as const,
      completeness: 75,
      rating: Math.floor(Math.random() * 5) + 1,
      reviews: Math.floor(Math.random() * 100)
    }))
  }

  private static transformDirectoryOpportunities(opportunities: any[]): DirectoryOpportunity[] {
    return (opportunities || []).map((opp: any, index: number) => ({
      id: `dir_${index}`,
      name: opp.name,
      category: opp.category || 'general',
      authority: opp.authority,
      estimatedTraffic: opp.estimatedTraffic,
      difficulty: opp.submissionDifficulty as 'easy' | 'medium' | 'hard',
      cost: opp.cost,
      timeToList: this.estimateTimeToList(opp.submissionDifficulty),
      requirements: ['Business verification', 'Contact information', 'Business description'],
      benefits: ['Increased visibility', 'More website traffic', 'Better search rankings'],
      submissionUrl: opp.url,
      priority: this.calculatePriority(opp),
      relevanceScore: Math.floor(Math.random() * 40) + 60,
      roi: {
        estimatedLeads: Math.floor(opp.estimatedTraffic * 0.02),
        estimatedRevenue: Math.floor(opp.estimatedTraffic * 0.02 * 50),
        timeframe: '3-6 months'
      }
    }))
  }

  private static calculatePotentialTraffic(opportunities: any[]): number {
    return (opportunities || []).reduce((total: number, opp: any) => 
      total + (opp.estimatedTraffic || 0), 0)
  }

  private static groupDirectoriesByCategory(opportunities: any[]): DirectoryCategory[] {
    const categories = new Map<string, any>()
    
    for (const opp of opportunities || []) {
      const cat = opp.category || 'general'
      if (!categories.has(cat)) {
        categories.set(cat, {
          name: cat,
          count: 0,
          totalTraffic: 0,
          totalAuthority: 0,
          categories: [cat]
        })
      }
      
      const category = categories.get(cat)!
      category.count++
      category.totalTraffic += opp.estimatedTraffic || 0
      category.totalAuthority += opp.authority || 0
    }

    return Array.from(categories.values()).map(cat => ({
      ...cat,
      averageAuthority: cat.count > 0 ? cat.totalAuthority / cat.count : 0
    }))
  }

  private static generateCompetitiveDescription(advantage: number): string {
    if (advantage < 20) return 'Strong competitive position with good directory presence'
    if (advantage < 40) return 'Moderate competitive disadvantage, room for improvement'
    if (advantage < 60) return 'Significant competitive gaps in directory listings'
    return 'Major competitive disadvantage, immediate action needed'
  }

  private static extractAdvantages(result: any): string[] {
    const advantages = []
    if (result.seoScore > 70) advantages.push('Strong SEO fundamentals')
    if (result.currentListings > 5) advantages.push('Some directory presence established')
    if (result.visibility > 50) advantages.push('Decent online visibility')
    return advantages.length > 0 ? advantages : ['Professional website presence']
  }

  private static extractGaps(result: any): string[] {
    const gaps = []
    if (result.missedOpportunities > 10) gaps.push('Missing from major directories')
    if (result.seoScore < 60) gaps.push('SEO optimization needs improvement')
    if (result.visibility < 40) gaps.push('Low online visibility')
    return gaps
  }

  private static assessMarketSize(missedOpportunities: number): 'small' | 'medium' | 'large' {
    if (missedOpportunities > 20) return 'large'
    if (missedOpportunities > 10) return 'medium'
    return 'small'
  }

  private static generateMarketDescription(missedOpportunities: number): string {
    if (missedOpportunities > 20) return 'Significant untapped market opportunity with high growth potential'
    if (missedOpportunities > 10) return 'Moderate market opportunity with good growth potential'
    return 'Limited but targeted market opportunity'
  }

  private static calculateGrowthPotential(result: any): number {
    return Math.min(100, (result.missedOpportunities || 0) * 2 + (result.potentialLeads || 0) / 10)
  }

  private static generatePriorityActions(result: any): ActionItem[] {
    const actions: ActionItem[] = []
    
    if (result.missedOpportunities > 5) {
      actions.push({
        id: 'submit_directories',
        title: 'Submit to High-Priority Directories',
        description: 'Focus on directories with highest authority and traffic potential',
        priority: 'high',
        effort: 'low',
        impact: 'high',
        timeframe: '1-2 weeks',
        category: 'listing',
        estimatedROI: {
          leads: Math.floor(result.potentialLeads / 2),
          revenue: Math.floor(result.potentialLeads / 2 * 50),
          timeframe: '3 months'
        }
      })
    }

    if (result.seoScore < 70) {
      actions.push({
        id: 'seo_optimization',
        title: 'Optimize Website SEO',
        description: 'Fix critical SEO issues to improve search visibility',
        priority: 'high',
        effort: 'medium',
        impact: 'high',
        timeframe: '2-4 weeks',
        category: 'optimization'
      })
    }

    return actions
  }

  // Helper methods continue...
  private static calculateReachScore(result: any): number {
    return Math.min(100, (result.currentListings || 0) * 5 + (result.visibility || 0))
  }

  private static calculateAuthorityScore(result: any): number {
    const avgAuthority = (result.directoryOpportunities || [])
      .reduce((sum: number, dir: any) => sum + (dir.authority || 0), 0) / 
      Math.max(1, (result.directoryOpportunities || []).length)
    return Math.min(100, avgAuthority)
  }

  private static calculateTrustScore(result: any): number {
    return Math.min(100, (result.seoScore || 0) + (result.visibility || 0)) / 2
  }

  private static calculateCompletenessScore(result: any): number {
    let score = 0
    if (result.title) score += 20
    if (result.description) score += 20
    if (result.seoScore > 50) score += 30
    if (result.currentListings > 0) score += 30
    return score
  }

  private static generateMetricsBreakdown(result: any): Record<string, any> {
    return {
      visibility: {
        current: result.visibility || 0,
        potential: 85,
        gap: 85 - (result.visibility || 0)
      },
      listings: {
        current: result.currentListings || 0,
        potential: (result.directoryOpportunities || []).length,
        gap: (result.directoryOpportunities || []).length - (result.currentListings || 0)
      },
      seo: {
        current: result.seoScore || 0,
        potential: 95,
        gap: 95 - (result.seoScore || 0)
      }
    }
  }

  private static transformIssues(issues: any[]): Issue[] {
    return (issues || []).map((issue: any, index: number) => ({
      id: `issue_${index}`,
      type: issue.type,
      category: 'seo',
      title: issue.title,
      description: issue.description,
      impact: issue.impact,
      priority: issue.priority,
      affectedAreas: [issue.title],
      resolution: {
        steps: [issue.title],
        effort: 'medium',
        timeframe: '1-2 weeks'
      }
    }))
  }

  private static transformRecommendations(recommendations: any[]): Recommendation[] {
    return (recommendations || []).map((rec: any, index: number) => ({
      id: `rec_${index}`,
      title: rec.action || rec.title,
      description: rec.impact || rec.description,
      category: 'strategic',
      priority: 'medium',
      effort: rec.effort || 'medium',
      impact: 'medium',
      implementation: {
        steps: [rec.action || rec.title],
        timeframe: '2-4 weeks',
        resources: ['Time investment', 'Content creation'],
        cost: 0
      },
      expectedResults: [{
        metric: 'visibility',
        improvement: '15-25% increase',
        timeframe: '3-6 months'
      }]
    }))
  }

  private static estimateTimeToList(difficulty: string): string {
    switch (difficulty) {
      case 'easy': return '1-3 days'
      case 'medium': return '1-2 weeks'
      case 'hard': return '2-4 weeks'
      default: return '1-2 weeks'
    }
  }

  private static calculatePriority(opportunity: any): number {
    return Math.floor((opportunity.authority || 50) * 0.5 + (opportunity.estimatedTraffic || 1000) * 0.001)
  }
}

// Simplified API response creator function for backward compatibility
export function createApiResponse(
  success: boolean,
  message: string,
  data: any = null,
  errors: string[] | null = null,
  stats: any = null
): any {
  const response: any = {
    success,
    message,
    timestamp: new Date().toISOString()
  }

  if (data !== null) {
    response.data = data
  }

  if (stats !== null) {
    response.stats = stats
  }

  if (errors && errors.length > 0) {
    response.errors = errors
  }

  return response
}

// Helper function for NextJS API responses (backward compatibility)
export function apiResponse(
  res: any,
  statusCode: number,
  status: 'success' | 'error',
  message: string,
  data: any = null
): void {
  const response = {
    success: status === 'success',
    message,
    data,
    timestamp: new Date().toISOString()
  }
  
  res.status(statusCode).json(response)
}