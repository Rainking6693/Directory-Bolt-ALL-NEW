/**
 * Competitive Intelligence Engine
 * Strategic competitive analysis for directory submissions
 */

import { callAI, isAnthropicAvailable, isGeminiAvailable } from '../utils/anthropic-client'
import { logger } from '../utils/logger'

export interface CompetitorInsight {
  competitors: Array<{
    name: string
    domain: string
    directoryPresence: number
    strengths: string[]
    weaknesses: string[]
    marketShare: number
  }>
  marketShare: number
  trend: 'growing' | 'declining' | 'stable'
  competitiveAdvantages: string[]
  threats: string[]
}

export interface MarketOpportunity {
  opportunities: Array<{
    directory: string
    opportunity: string
    potentialImpact: number
    effort: 'low' | 'medium' | 'high'
    timeframe: string
  }>
  priority: 'high' | 'medium' | 'low'
  estimatedValue: number
}

export interface RankingForecast {
  expectedChange: number
  confidence: number
  timeframe: string
  factors: string[]
  recommendations: string[]
}

export interface StrategicInsight {
  type: 'opportunity' | 'threat' | 'recommendation'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  actionable: boolean
  expectedImpact: number
}

export interface CompetitiveIntelligenceRequest {
  targetWebsite: string
  industry: string
  competitors?: string[]
  focusAreas?: string[]
}

class DirectoryCompetitiveIntelligence {
  private competitorTracker: Map<string, any> = new Map()
  private marketAnalyzer: Map<string, any> = new Map()
  private rankingPredictor: Map<string, any> = new Map()

  async trackCompetitors(request: CompetitiveIntelligenceRequest): Promise<CompetitorInsight> {
    try {
      logger.info('Tracking competitors', { metadata: { targetWebsite: request.targetWebsite } })

      // Use Gemini for simple competitor discovery
      const competitorPrompt = `
        Identify top 5-8 competitors for ${request.targetWebsite} in the ${request.industry} industry.
        Focus on businesses with similar services/products and strong directory presence.
        
        Return JSON format:
        {
          "competitors": [
            {
              "name": "Competitor name",
              "domain": "competitor.com",
              "directoryPresence": 45,
              "strengths": ["strength1", "strength2"],
              "weaknesses": ["weakness1"],
              "marketShare": 15
            }
          ],
          "competitiveAdvantages": ["advantage1", "advantage2"],
          "threats": ["threat1", "threat2"]
        }
      `

      const response = await callAI(competitorPrompt, 'simple', {
        geminiModel: 'gemini-pro',
        maxTokens: 1500,
        temperature: 0.4
      })

      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        return {
          competitors: data.competitors || [],
          marketShare: data.marketShare || 0,
          trend: 'stable' as const,
          competitiveAdvantages: data.competitiveAdvantages || [],
          threats: data.threats || []
        }
      }

      return {
        competitors: [],
        marketShare: 0,
        trend: 'stable',
        competitiveAdvantages: [],
        threats: []
      }
    } catch (error) {
      logger.error('Competitor tracking failed', {}, error as Error)
      throw error
    }
  }

  async analyzeMarketOpportunities(request: CompetitiveIntelligenceRequest): Promise<MarketOpportunity> {
    try {
      logger.info('Analyzing market opportunities', { metadata: { targetWebsite: request.targetWebsite } })

      // Use Anthropic for complex market analysis
      const opportunityPrompt = `
        Analyze market opportunities for ${request.targetWebsite} in the ${request.industry} industry.
        
        Identify:
        1. Underserved directories with high potential
        2. Content gaps competitors are missing
        3. Strategic positioning opportunities
        4. Low-effort, high-impact wins
        
        Return JSON format:
        {
          "opportunities": [
            {
              "directory": "Directory name",
              "opportunity": "Specific opportunity description",
              "potentialImpact": 85,
              "effort": "low",
              "timeframe": "2-4 weeks"
            }
          ],
          "estimatedValue": 50000
        }
      `

      const response = await callAI(opportunityPrompt, 'complex', {
        anthropicModel: 'claude-3-sonnet-20241022',
        maxTokens: 2000,
        temperature: 0.3,
        systemPrompt: 'You are an expert competitive intelligence analyst. Provide strategic market opportunities in JSON format.'
      })

      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        return {
          opportunities: data.opportunities || [],
          priority: data.opportunities?.length > 0 ? 'high' : 'medium',
          estimatedValue: data.estimatedValue || 0
        }
      }

      return {
        opportunities: [],
        priority: 'medium',
        estimatedValue: 0
      }
    } catch (error) {
      logger.error('Market opportunity analysis failed', {}, error as Error)
      throw error
    }
  }

  async predictRankingChanges(request: CompetitiveIntelligenceRequest): Promise<RankingForecast> {
    try {
      logger.info('Predicting ranking changes', { metadata: { targetWebsite: request.targetWebsite } })

      // Use Anthropic for complex prediction analysis
      const predictionPrompt = `
        Predict directory ranking changes for ${request.targetWebsite} over the next 3-6 months.
        
        Consider:
        - Current directory presence
        - Competitor activity
        - Market trends
        - Strategic opportunities
        
        Return JSON format:
        {
          "expectedChange": 25,
          "confidence": 0.75,
          "timeframe": "3-6 months",
          "factors": ["factor1", "factor2"],
          "recommendations": ["recommendation1", "recommendation2"]
        }
      `

      const response = await callAI(predictionPrompt, 'complex', {
        anthropicModel: 'claude-3-sonnet-20241022',
        maxTokens: 1500,
        temperature: 0.2,
        systemPrompt: 'You are an expert predictive analyst. Provide data-driven ranking forecasts in JSON format.'
      })

      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }

      return {
        expectedChange: 0,
        confidence: 0.5,
        timeframe: '3-6 months',
        factors: [],
        recommendations: []
      }
    } catch (error) {
      logger.error('Ranking prediction failed', {}, error as Error)
      throw error
    }
  }

  async generateStrategicInsights(request: CompetitiveIntelligenceRequest): Promise<StrategicInsight[]> {
    try {
      logger.info('Generating strategic insights', { metadata: { targetWebsite: request.targetWebsite } })

      // Use Anthropic for complex strategic analysis
      const insightsPrompt = `
        Generate strategic insights for ${request.targetWebsite} in the ${request.industry} industry.
        
        Provide insights covering:
        1. Competitive opportunities
        2. Market threats
        3. Strategic recommendations
        
        Return JSON array format:
        [
          {
            "type": "opportunity",
            "title": "Insight title",
            "description": "Detailed description",
            "priority": "high",
            "actionable": true,
            "expectedImpact": 85
          }
        ]
      `

      const response = await callAI(insightsPrompt, 'complex', {
        anthropicModel: 'claude-3-sonnet-20241022',
        maxTokens: 2500,
        temperature: 0.3,
        systemPrompt: 'You are a strategic business consultant. Provide actionable competitive insights in JSON format.'
      })

      const jsonMatch = response.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }

      return []
    } catch (error) {
      logger.error('Strategic insights generation failed', {}, error as Error)
      throw error
    }
  }
}

export const competitiveIntelligenceEngine = new DirectoryCompetitiveIntelligence()
