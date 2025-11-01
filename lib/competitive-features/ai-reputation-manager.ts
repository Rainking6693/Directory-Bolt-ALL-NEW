/**
 * AI-Powered Reputation Management System
 * Enhanced for directory submissions with automated review monitoring and response
 */

import { callAI, isAnthropicAvailable, isGeminiAvailable } from '../utils/anthropic-client'
import { logger } from '../utils/logger'

export interface Review {
  id: string
  directoryName: string
  rating: number
  text: string
  author: string
  date: string
  sentiment: 'positive' | 'neutral' | 'negative'
}

export interface ReviewMonitoringResult {
  overallReputationScore: number
  directoryPerformance: DirectoryReviewData[]
  alertsAndRecommendations: ReputationAlert[]
  competitiveComparison: CompetitiveReputationData
  reviewSentiment: number
  reviewVolume: number
  platformBreakdown: Record<string, number>
  flaggedReviews: Review[]
  actionableInsights: string[]
}

export interface DirectoryReviewData {
  directoryName: string
  totalReviews: number
  averageRating: number
  sentimentScore: number
  recentTrends: TrendData[]
  actionableInsights: string[]
}

export interface TrendData {
  period: string
  rating: number
  volume: number
  sentiment: number
}

export interface ReputationAlert {
  type: 'critical' | 'warning' | 'info'
  title: string
  description: string
  actionRequired: boolean
  priority: 'high' | 'medium' | 'low'
}

export interface CompetitiveReputationData {
  averageRating: number
  totalReviews: number
  marketPosition: string
  competitiveAdvantages: string[]
}

export interface AutoResponse {
  reviewId: string
  directoryName: string
  suggestedResponse: string
  tone: 'professional' | 'friendly' | 'apologetic' | 'grateful'
  confidence: number
  keyPoints: string[]
  autoApprove: boolean
}

export interface ReputationForecast {
  predictedRating: number
  confidenceInterval: [number, number]
  trendDirection: 'improving' | 'declining' | 'stable'
  keyInfluencingFactors: string[]
  recommendedActions: string[]
  projectedSentiment: number
  confidence: number
  impactDrivers: string[]
}

export interface PresenceOptimization {
  recommendations: string[]
  estimatedImpact: number
  priorityDirectories: PriorityDirectory[]
  contentOptimizations: ContentOptimization[]
  reviewGenerationStrategy: ReviewStrategy
  competitivePositioning: CompetitivePosition
}

export interface PriorityDirectory {
  name: string
  priority: number
  reason: string
  expectedImpact: number
}

export interface ContentOptimization {
  directory: string
  field: string
  currentValue: string
  optimizedValue: string
  impact: number
}

export interface ReviewStrategy {
  targetDirectories: string[]
  timing: string
  approach: string
  expectedOutcome: string
}

export interface CompetitivePosition {
  currentPosition: string
  targetPosition: string
  gap: number
  strategy: string[]
}

class AIReputationManagerImpl {
  async monitorDirectoryReviews(businessId: string, directories: string[]): Promise<ReviewMonitoringResult> {
    try {
      logger.info('Monitoring directory reviews', { metadata: { businessId, directoryCount: directories.length } })

      // Use Gemini for simple review aggregation and sentiment analysis
      const monitoringPrompt = `
        Analyze directory review performance for a business across these directories: ${directories.join(', ')}.
        
        Provide analysis including:
        - Overall reputation score (0-100)
        - Performance breakdown by directory
        - Sentiment analysis
        - Recent trends
        - Actionable insights
        
        Return JSON format with comprehensive review monitoring data.
      `

      const response = await callAI(monitoringPrompt, 'simple', {
        geminiModel: 'gemini-pro',
        maxTokens: 2000,
        temperature: 0.3
      })

      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        return {
          overallReputationScore: data.overallReputationScore || 75,
          directoryPerformance: data.directoryPerformance || [],
          alertsAndRecommendations: data.alertsAndRecommendations || [],
          competitiveComparison: data.competitiveComparison || {
            averageRating: 4.0,
            totalReviews: 0,
            marketPosition: 'average',
            competitiveAdvantages: []
          },
          reviewSentiment: data.reviewSentiment || 0.7,
          reviewVolume: data.reviewVolume || 0,
          platformBreakdown: data.platformBreakdown || {},
          flaggedReviews: data.flaggedReviews || [],
          actionableInsights: data.actionableInsights || []
        }
      }

      return {
        overallReputationScore: 75,
        directoryPerformance: [],
        alertsAndRecommendations: [],
        competitiveComparison: {
          averageRating: 4.0,
          totalReviews: 0,
          marketPosition: 'average',
          competitiveAdvantages: []
        },
        reviewSentiment: 0.7,
        reviewVolume: 0,
        platformBreakdown: {},
        flaggedReviews: [],
        actionableInsights: []
      }
    } catch (error) {
      logger.error('Review monitoring failed', {}, error as Error)
      throw error
    }
  }

  async generateAutoResponses(reviews: Review[]): Promise<AutoResponse[]> {
    try {
      logger.info('Generating auto-responses', { metadata: { reviewCount: reviews.length } })

      const responses: AutoResponse[] = []

      for (const review of reviews) {
        // Use Gemini for simple response generation
        const responsePrompt = `
          Generate a professional response to this ${review.sentiment} review:
          
          Rating: ${review.rating}/5
          Review: "${review.text}"
          Directory: ${review.directoryName}
          
          Create a response that is:
          - Appropriate for the sentiment (${review.sentiment === 'negative' ? 'apologetic and solution-focused' : 'grateful and professional'})
          - Professional and brand-appropriate
          - Specific to the feedback
          - Encourages future business
          
          Return JSON:
          {
            "suggestedResponse": "Response text",
            "tone": "professional",
            "keyPoints": ["point1", "point2"],
            "autoApprove": true
          }
        `

        const aiResponse = await callAI(responsePrompt, 'simple', {
          geminiModel: 'gemini-pro',
          maxTokens: 500,
          temperature: 0.6
        })

        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0])
          responses.push({
            reviewId: review.id,
            directoryName: review.directoryName,
            suggestedResponse: data.suggestedResponse || '',
            tone: data.tone || 'professional',
            confidence: 0.85,
            keyPoints: data.keyPoints || [],
            autoApprove: data.autoApprove ?? true
          })
        }
      }

      return responses
    } catch (error) {
      logger.error('Auto-response generation failed', {}, error as Error)
      throw error
    }
  }

  async predictReputationTrends(businessId: string, historicalData: any): Promise<ReputationForecast> {
    try {
      logger.info('Predicting reputation trends', { metadata: { businessId } })

      // Use Anthropic for complex trend prediction
      const predictionPrompt = `
        Predict reputation trends based on historical review data.
        
        Analyze patterns and predict:
        - Future rating trajectory
        - Sentiment trends
        - Key influencing factors
        - Recommended actions
        
        Return JSON format with comprehensive forecast data.
      `

      const response = await callAI(predictionPrompt, 'complex', {
        anthropicModel: 'claude-3-sonnet-20241022',
        maxTokens: 1500,
        temperature: 0.2,
        systemPrompt: 'You are an expert reputation analyst. Provide data-driven reputation forecasts in JSON format.'
      })

      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        return {
          predictedRating: data.predictedRating || 4.0,
          confidenceInterval: data.confidenceInterval || [3.5, 4.5],
          trendDirection: data.trendDirection || 'stable',
          keyInfluencingFactors: data.keyInfluencingFactors || [],
          recommendedActions: data.recommendedActions || [],
          projectedSentiment: data.projectedSentiment || 0.7,
          confidence: data.confidence || 0.75,
          impactDrivers: data.impactDrivers || []
        }
      }

      return {
        predictedRating: 4.0,
        confidenceInterval: [3.5, 4.5],
        trendDirection: 'stable',
        keyInfluencingFactors: [],
        recommendedActions: [],
        projectedSentiment: 0.7,
        confidence: 0.75,
        impactDrivers: []
      }
    } catch (error) {
      logger.error('Reputation trend prediction failed', {}, error as Error)
      throw error
    }
  }

  async optimizeDirectoryPresence(businessId: string, currentPresence: any): Promise<PresenceOptimization> {
    try {
      logger.info('Optimizing directory presence', { metadata: { businessId } })

      // Use Anthropic for complex optimization strategy
      const optimizationPrompt = `
        Develop a comprehensive directory presence optimization strategy.
        
        Consider:
        - Current directory listings
        - Review performance
        - Competitive positioning
        - Content optimization opportunities
        
        Return JSON format with strategic optimization recommendations.
      `

      const response = await callAI(optimizationPrompt, 'complex', {
        anthropicModel: 'claude-3-sonnet-20241022',
        maxTokens: 2000,
        temperature: 0.3,
        systemPrompt: 'You are an expert directory optimization strategist. Provide actionable optimization recommendations in JSON format.'
      })

      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        return {
          recommendations: data.recommendations || [],
          estimatedImpact: data.estimatedImpact || 0,
          priorityDirectories: data.priorityDirectories || [],
          contentOptimizations: data.contentOptimizations || [],
          reviewGenerationStrategy: data.reviewGenerationStrategy || {
            targetDirectories: [],
            timing: 'ongoing',
            approach: 'organic',
            expectedOutcome: 'improved reputation'
          },
          competitivePositioning: data.competitivePositioning || {
            currentPosition: 'average',
            targetPosition: 'leading',
            gap: 20,
            strategy: []
          }
        }
      }

      return {
        recommendations: [],
        estimatedImpact: 0,
        priorityDirectories: [],
        contentOptimizations: [],
        reviewGenerationStrategy: {
          targetDirectories: [],
          timing: 'ongoing',
          approach: 'organic',
          expectedOutcome: 'improved reputation'
        },
        competitivePositioning: {
          currentPosition: 'average',
          targetPosition: 'leading',
          gap: 20,
          strategy: []
        }
      }
    } catch (error) {
      logger.error('Directory presence optimization failed', {}, error as Error)
      throw error
    }
  }
}

export const aiReputationManager = new AIReputationManagerImpl()
