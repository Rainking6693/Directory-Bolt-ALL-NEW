// @ts-nocheck
/**
 * Phase 3.2: Customer Dashboard API - AI Enhanced Integration
 * 
 * This endpoint provides comprehensive customer dashboard data including
 * AI analysis results, directory opportunities, optimization progress,
 * and actionable recommendations for the DirectoryBolt AI-Enhanced platform.
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { createEnhancedAIIntegrationService } from '../../../lib/services/enhanced-ai-integration'

interface CustomerDashboardRequest {
  customerId: string
  includeAnalysis?: boolean
  includeRecommendations?: boolean
  includeProgress?: boolean
}

interface CustomerDashboardResponse {
  success: boolean
  data?: {
    businessProfile: {
      businessName: string
      website: string
      description: string
      email: string
      phone?: string
      city: string
      state: string
      packageType: string
    }
    analysisResults?: {
      confidence: number
      industryCategory: string
      competitivePositioning: string
      marketPositioning: any
      successMetrics: any
    }
    directoryOpportunities?: {
      totalDirectories: number
      prioritySubmissions: Array<{
        directoryName: string
        priority: number
        successProbability: number
        estimatedROI: number
        category: string
      }>
      estimatedResults: {
        trafficIncrease: number
        leadIncrease: number
        timeToResults: any
      }
    }
    optimizationProgress?: {
      directoriesSubmitted: number
      failedDirectories: number
      approvalRate: number
      submissionStatus: string
      progressVsPredictions?: {
        trafficVariance: number
        leadVariance: number
        status: string
      }
    }
    recommendations?: {
      immediateActions: string[]
      shortTermGoals: string[]
      longTermStrategy: string[]
      seoRecommendations: string[]
      priorityDirectories: Array<{
        name: string
        priority: number
        estimatedROI: number
      }>
    }
    cacheStatus: {
      lastUpdated: Date | null
      daysOld: number
      needsRefresh: boolean
      confidenceScore?: number
    }
    metadata: {
      analysisVersion?: string
      packageLimits: {
        totalDirectories: number
        used: number
        remaining: number
      }
      nextSteps: string[]
    }
  }
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CustomerDashboardResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use GET.' 
    })
  }

  try {
    const { 
      customerId,
      includeAnalysis = true,
      includeRecommendations = true,
      includeProgress = true 
    } = req.query as any

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'customerId is required'
      })
    }

    console.log('📋 Getting customer dashboard data for:', customerId)

    // Initialize AI integration service
    const aiIntegrationService = createEnhancedAIIntegrationService()

    // Get comprehensive dashboard data
    const dashboardData = await aiIntegrationService.getCustomerDashboardData(customerId as string)

    // Structure response based on request parameters
    const responseData: CustomerDashboardResponse['data'] = {
      businessProfile: dashboardData.businessProfile,
      cacheStatus: dashboardData.cacheStatus,
      metadata: {
        analysisVersion: dashboardData.analysisResults?.analysisTimestamp ? '3.2.0' : undefined,
        packageLimits: calculatePackageLimits(
          dashboardData.businessProfile.packageType,
          dashboardData.optimizationProgress.directoriesSubmitted
        ),
        nextSteps: generateNextSteps(
          dashboardData.cacheStatus,
          dashboardData.optimizationProgress
        )
      }
    }

    // Include analysis results if requested
    if (includeAnalysis && dashboardData.analysisResults) {
      responseData.analysisResults = {
        confidence: dashboardData.analysisResults.confidence,
        industryCategory: dashboardData.analysisResults.industryAnalysis.primaryIndustry,
        competitivePositioning: dashboardData.analysisResults.competitiveAnalysis.competitiveAdvantages.slice(0, 3).join(', '),
        marketPositioning: dashboardData.analysisResults.marketPositioning,
        successMetrics: dashboardData.analysisResults.successMetrics
      }
    }

    // Include directory opportunities if available
    if (dashboardData.directoryOpportunities) {
      responseData.directoryOpportunities = {
        totalDirectories: dashboardData.directoryOpportunities.totalDirectories || 150,
        prioritySubmissions: dashboardData.directoryOpportunities.prioritizedSubmissions?.slice(0, 10) || [],
        estimatedResults: {
          trafficIncrease: 250,
          leadIncrease: 15,
          timeToResults: {
            immediate: 3,
            shortTerm: 14,
            mediumTerm: 45,
            longTerm: 90
          }
        }
      }
    }

    // Include optimization progress if requested
    if (includeProgress) {
      const progress = dashboardData.optimizationProgress
      responseData.optimizationProgress = {
        directoriesSubmitted: progress.directoriesSubmitted || 0,
        failedDirectories: progress.failedDirectories || 0,
        approvalRate: progress.directoriesSubmitted > 0 
          ? ((progress.directoriesSubmitted - progress.failedDirectories) / progress.directoriesSubmitted) * 100 
          : 0,
        submissionStatus: progress.submissionStatus || 'pending',
        progressVsPredictions: calculateProgressVsPredictions(progress)
      }
    }

    // Include recommendations if requested
    if (includeRecommendations && dashboardData.recommendations) {
      responseData.recommendations = {
        immediateActions: [
          'Complete Google My Business setup',
          'Optimize website meta tags',
          'Submit to top priority directories'
        ],
        shortTermGoals: [
          'Implement SEO improvements',
          'Gather customer testimonials',
          'Complete directory submission campaign'
        ],
        longTermStrategy: [
          'Develop content marketing strategy',
          'Build industry authority',
          'Expand to secondary markets'
        ],
        seoRecommendations: Array.isArray(dashboardData.recommendations.seoRecommendations) 
          ? dashboardData.recommendations.seoRecommendations 
          : [],
        priorityDirectories: dashboardData.directoryOpportunities?.prioritizedSubmissions?.slice(0, 5).map(dir => ({
          name: dir.directoryName,
          priority: dir.priority,
          estimatedROI: dir.expectedROI
        })) || []
      }
    }

    console.log('✅ Customer dashboard data retrieved successfully')

    return res.status(200).json({
      success: true,
      data: responseData
    })

  } catch (error) {
    console.error('❌ Failed to get customer dashboard data:', error)
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve dashboard data'
    })
  }
}

/**
 * Helper: Calculate package limits and usage
 */
function calculatePackageLimits(packageType: string, directoriesUsed: number): {
  totalDirectories: number
  used: number
  remaining: number
} {
  const packageLimits = {
    starter: 50,
    growth: 100,
    pro: 200,
    subscription: 0 // Unlimited for subscription
  }

  const total = packageLimits[packageType.toLowerCase() as keyof typeof packageLimits] || 50
  const used = directoriesUsed || 0
  const remaining = total > 0 ? Math.max(0, total - used) : 999 // 999 for unlimited

  return {
    totalDirectories: total,
    used,
    remaining
  }
}

/**
 * Helper: Generate next steps based on current status
 */
function generateNextSteps(
  cacheStatus: { needsRefresh: boolean; daysOld: number },
  progress: { submissionStatus: string; directoriesSubmitted: number }
): string[] {
  const steps: string[] = []

  if (cacheStatus.needsRefresh) {
    steps.push('Run fresh AI analysis to get updated recommendations')
  }

  if (progress.submissionStatus === 'pending') {
    steps.push('Begin directory submission process')
  } else if (progress.submissionStatus === 'in-progress') {
    steps.push('Continue directory submissions according to strategy')
  }

  if (progress.directoriesSubmitted === 0) {
    steps.push('Start with high-priority directories for quick wins')
  } else if (progress.directoriesSubmitted < 10) {
    steps.push('Expand submissions to industry-specific directories')
  } else {
    steps.push('Focus on optimization and performance monitoring')
  }

  return steps
}

/**
 * Helper: Calculate progress vs predictions
 */
function calculateProgressVsPredictions(progress: any): {
  trafficVariance: number
  leadVariance: number
  status: string
} {
  // This would integrate with actual analytics data
  // For now, return mock calculations
  const trafficVariance = Math.random() * 40 - 20 // -20% to +20%
  const leadVariance = Math.random() * 30 - 15 // -15% to +15%

  let status = 'On track'
  if (trafficVariance > 10 && leadVariance > 5) status = 'Exceeding expectations'
  else if (trafficVariance < -10 || leadVariance < -10) status = 'Below expectations'

  return {
    trafficVariance: Math.round(trafficVariance * 100) / 100,
    leadVariance: Math.round(leadVariance * 100) / 100,
    status
  }
}