/**
 * Growth Strategy Engine
 * 
 * Generates dynamic growth roadmaps and revenue projections:
 * - Identify gaps and opportunities
 * - Generate growth roadmaps
 * - AI-estimated revenue projections based on visibility increase
 * - Actionable recommendations
 */

import { callAI } from '../utils/anthropic-client'
import { logger } from '../utils/logger'
import type { BusinessProfile } from './ai-business-profiler'
import type { CompetitiveAnalysis } from './competitive-intelligence'
import type { ScrapedBusinessData } from './enhanced-website-scraper'

export interface GrowthRoadmap {
  shortTerm: GrowthAction[] // 0-3 months
  mediumTerm: GrowthAction[] // 3-6 months
  longTerm: GrowthAction[] // 6-12 months
}

export interface GrowthAction {
  title: string
  description: string
  priority: 'High' | 'Medium' | 'Low'
  estimatedImpact: string
  effort: 'Low' | 'Medium' | 'High'
  timeline: string
  dependencies?: string[]
  metrics: {
    visibilityIncrease?: number
    trafficIncrease?: number
    leadIncrease?: number
    revenuePotential?: number
  }
}

export interface RevenueProjection {
  currentState: {
    monthlyTraffic: number
    monthlyLeads: number
    monthlyRevenue: number
    conversionRate: number
  }
  projectedState: {
    monthlyTraffic: number
    monthlyLeads: number
    monthlyRevenue: number
    conversionRate: number
  }
  projection: {
    sixMonths: RevenueProjectionPeriod
    twelveMonths: RevenueProjectionPeriod
  }
  assumptions: string[]
}

export interface RevenueProjectionPeriod {
  monthlyTraffic: number
  monthlyLeads: number
  monthlyRevenue: number
  cumulativeRevenue: number
  visibilityIncrease: number
}

/**
 * Growth Strategy Engine Service
 */
export class GrowthStrategyEngine {
  /**
   * Generate comprehensive growth roadmap
   */
  async generateGrowthRoadmap(
    businessProfile: BusinessProfile,
    competitiveAnalysis: CompetitiveAnalysis,
    scrapedData: ScrapedBusinessData,
    directoryCount: number
  ): Promise<GrowthRoadmap> {
    try {
      logger.info('Generating growth roadmap', { business: businessProfile.name })

      const gaps = this.identifyGaps(competitiveAnalysis, directoryCount)
      const opportunities = this.identifyOpportunities(businessProfile, competitiveAnalysis)
      
      // Generate roadmap actions
      const roadmap = await this.generateRoadmapActions(
        gaps,
        opportunities,
        businessProfile,
        competitiveAnalysis
      )

      logger.info('Growth roadmap generated', {
        business: businessProfile.name,
        shortTermActions: roadmap.shortTerm.length,
        mediumTermActions: roadmap.mediumTerm.length,
        longTermActions: roadmap.longTerm.length
      })

      return roadmap

    } catch (error) {
      logger.error('Growth roadmap generation failed', {
        error: error instanceof Error ? error.message : String(error)
      }, error as Error)

      // Return basic roadmap
      return this.createFallbackRoadmap(businessProfile, competitiveAnalysis)
    }
  }

  /**
   * Generate revenue projections based on visibility increase
   */
  async generateRevenueProjections(
    businessProfile: BusinessProfile,
    competitiveAnalysis: CompetitiveAnalysis,
    currentMetrics: {
      monthlyTraffic?: number
      monthlyLeads?: number
      monthlyRevenue?: number
    }
  ): Promise<RevenueProjection> {
    try {
      logger.info('Generating revenue projections', { business: businessProfile.name })

      // Estimate current state if not provided
      const currentState = {
        monthlyTraffic: currentMetrics.monthlyTraffic || this.estimateTraffic(businessProfile),
        monthlyLeads: currentMetrics.monthlyLeads || this.estimateLeads(businessProfile),
        monthlyRevenue: currentMetrics.monthlyRevenue || this.estimateRevenue(businessProfile),
        conversionRate: currentMetrics.monthlyRevenue && currentMetrics.monthlyLeads
          ? (currentMetrics.monthlyRevenue / currentMetrics.monthlyLeads) * 100
          : 2.5 // Default 2.5% conversion rate
      }

      // Calculate visibility gap
      const visibilityGap = competitiveAnalysis.directoryDensityComparison.leader - 
                            competitiveAnalysis.directoryDensityComparison.client

      // Estimate visibility increase from directory expansion
      const visibilityIncrease = Math.min(visibilityGap, 50) // Cap at 50% increase

      // Project future state
      const trafficMultiplier = 1 + (visibilityIncrease / 100) * 0.8 // 80% correlation
      const projectedState = {
        monthlyTraffic: Math.round(currentState.monthlyTraffic * trafficMultiplier),
        monthlyLeads: Math.round(currentState.monthlyLeads * trafficMultiplier),
        monthlyRevenue: Math.round(currentState.monthlyRevenue * trafficMultiplier),
        conversionRate: currentState.conversionRate // Assume conversion rate stays constant
      }

      // Generate projections for 6 and 12 months
      const sixMonths = this.calculateProjectionPeriod(
        currentState,
        projectedState,
        6,
        visibilityIncrease
      )

      const twelveMonths = this.calculateProjectionPeriod(
        currentState,
        projectedState,
        12,
        visibilityIncrease
      )

      const projection: RevenueProjection = {
        currentState,
        projectedState,
        projection: {
          sixMonths,
          twelveMonths
        },
        assumptions: [
          `Directory presence increases by ${visibilityIncrease}%`,
          'Traffic growth correlates with visibility increase (80% correlation)',
          'Conversion rate remains constant at current levels',
          'No major market disruptions',
          'Steady implementation of growth recommendations'
        ]
      }

      logger.info('Revenue projections generated', {
        business: businessProfile.name,
        currentRevenue: currentState.monthlyRevenue,
        projectedRevenue: projectedState.monthlyRevenue,
        sixMonthCumulative: sixMonths.cumulativeRevenue
      })

      return projection

    } catch (error) {
      logger.error('Revenue projection generation failed', {
        error: error instanceof Error ? error.message : String(error)
      }, error as Error)

      // Return basic projection
      return this.createFallbackProjection(businessProfile)
    }
  }

  /**
   * Identify gaps between client and competitors
   */
  private identifyGaps(
    competitiveAnalysis: CompetitiveAnalysis,
    currentDirectoryCount: number
  ): string[] {
    const gaps: string[] = []

    const avgListings = competitiveAnalysis.directoryDensityComparison.average
    const leaderListings = competitiveAnalysis.directoryDensityComparison.leader

    if (currentDirectoryCount < avgListings) {
      gaps.push(`Directory presence ${Math.round(avgListings - currentDirectoryCount)} directories below industry average`)
    }

    if (currentDirectoryCount < leaderListings) {
      gaps.push(`Directory presence ${Math.round(leaderListings - currentDirectoryCount)} directories below market leader`)
    }

    const avgSEO = competitiveAnalysis.competitors.reduce((sum, c) => sum + c.seoScore, 0) / competitiveAnalysis.competitors.length
    if (competitiveAnalysis.clientBenchmark.seoScore < avgSEO) {
      gaps.push(`SEO score ${Math.round(avgSEO - competitiveAnalysis.clientBenchmark.seoScore)} points below competitor average`)
    }

    return gaps
  }

  /**
   * Identify growth opportunities
   */
  private identifyOpportunities(
    businessProfile: BusinessProfile,
    competitiveAnalysis: CompetitiveAnalysis
  ): string[] {
    const opportunities: string[] = []

    // Add opportunities from competitive analysis
    if (competitiveAnalysis.insights.opportunities.length > 0) {
      opportunities.push(...competitiveAnalysis.insights.opportunities)
    }

    // Industry-specific opportunities
    if (businessProfile.industry === 'Professional Services') {
      opportunities.push('High-authority professional directories (Clutch, GoodFirms)')
      opportunities.push('Industry-specific associations and directories')
    }

    if (businessProfile.industry === 'Technology' || businessProfile.category.includes('SaaS')) {
      opportunities.push('Tech-focused directories (Product Hunt, G2, Capterra)')
      opportunities.push('Developer communities and platforms')
    }

    if (businessProfile.businessModel === 'B2B') {
      opportunities.push('B2B directories (LinkedIn, Crunchbase, ZoomInfo)')
    }

    if (businessProfile.businessModel === 'Local') {
      opportunities.push('Local business directories (Google My Business, Yelp, Bing Places)')
    }

    return opportunities
  }

  /**
   * Generate roadmap actions using AI
   */
  private async generateRoadmapActions(
    gaps: string[],
    opportunities: string[],
    businessProfile: BusinessProfile,
    competitiveAnalysis: CompetitiveAnalysis
  ): Promise<GrowthRoadmap> {
    try {
      const prompt = `Generate a growth roadmap for this business:

Business: ${businessProfile.name}
Industry: ${businessProfile.industry}
Category: ${businessProfile.category}

Current Gaps:
${gaps.map(g => `- ${g}`).join('\n')}

Opportunities:
${opportunities.map(o => `- ${o}`).join('\n')}

Competitive Position: ${competitiveAnalysis.clientBenchmark.marketPosition}
Directory Density: ${competitiveAnalysis.directoryDensityComparison.client} (avg: ${competitiveAnalysis.directoryDensityComparison.average}, leader: ${competitiveAnalysis.directoryDensityComparison.leader})

Provide a JSON roadmap:
{
  "shortTerm": [
    {
      "title": "Action title",
      "description": "Action description",
      "priority": "High|Medium|Low",
      "estimatedImpact": "Expected impact description",
      "effort": "Low|Medium|High",
      "timeline": "0-3 months",
      "metrics": {
        "visibilityIncrease": 10,
        "trafficIncrease": 15,
        "leadIncrease": 12,
        "revenuePotential": 5000
      }
    }
  ],
  "mediumTerm": [...],
  "longTerm": [...]
}

Focus on actionable, specific steps. Prioritize high-impact, low-effort actions first.`

      const aiResponse = await callAI(prompt, 'complex', {
        maxTokens: 4000,
        temperature: 0.3
      })

      // Parse AI response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          shortTerm: Array.isArray(parsed.shortTerm) ? parsed.shortTerm : [],
          mediumTerm: Array.isArray(parsed.mediumTerm) ? parsed.mediumTerm : [],
          longTerm: Array.isArray(parsed.longTerm) ? parsed.longTerm : []
        }
      }
    } catch (error) {
      logger.warn('AI roadmap generation failed, using fallback', { error })
    }

    // Fallback roadmap
    return this.createFallbackRoadmap(businessProfile, competitiveAnalysis)
  }

  /**
   * Calculate projection period
   */
  private calculateProjectionPeriod(
    current: RevenueProjection['currentState'],
    projected: RevenueProjection['projectedState'],
    months: number,
    visibilityIncrease: number
  ): RevenueProjectionPeriod {
    // Linear growth assumption
    const monthlyGrowth = (projected.monthlyTraffic - current.monthlyTraffic) / months
    const periodTraffic = current.monthlyTraffic + (monthlyGrowth * months)
    
    const periodLeads = Math.round(periodTraffic * (current.conversionRate / 100))
    const periodRevenue = Math.round(periodLeads * (current.monthlyRevenue / current.monthlyLeads))
    const cumulativeRevenue = periodRevenue * months

    return {
      monthlyTraffic: Math.round(periodTraffic),
      monthlyLeads: periodLeads,
      monthlyRevenue: periodRevenue,
      cumulativeRevenue,
      visibilityIncrease
    }
  }

  /**
   * Estimate traffic based on business profile
   */
  private estimateTraffic(profile: BusinessProfile): number {
    // Rough estimates based on industry and model
    if (profile.businessModel === 'B2B') {
      return 5000 // B2B typically has lower traffic but higher value
    } else if (profile.businessModel === 'B2C') {
      return 15000 // B2C typically has higher traffic
    } else if (profile.businessModel === 'Local') {
      return 3000 // Local businesses have moderate traffic
    }
    return 5000 // Default
  }

  /**
   * Estimate leads based on traffic and conversion rate
   */
  private estimateLeads(profile: BusinessProfile): number {
    const traffic = this.estimateTraffic(profile)
    const conversionRate = profile.businessModel === 'B2B' ? 0.02 : 0.01 // 2% for B2B, 1% for B2C
    return Math.round(traffic * conversionRate)
  }

  /**
   * Estimate revenue based on leads
   */
  private estimateRevenue(profile: BusinessProfile): number {
    const leads = this.estimateLeads(profile)
    const avgDealSize = profile.businessModel === 'B2B' ? 5000 : 100 // $5k B2B, $100 B2C
    return leads * avgDealSize * 0.1 // Assume 10% close rate
  }

  /**
   * Create fallback roadmap
   */
  private createFallbackRoadmap(
    businessProfile: BusinessProfile,
    competitiveAnalysis: CompetitiveAnalysis
  ): GrowthRoadmap {
    const visibilityGap = competitiveAnalysis.directoryDensityComparison.leader - 
                          competitiveAnalysis.directoryDensityComparison.client

    return {
      shortTerm: [
        {
          title: 'Expand High-Authority Directory Presence',
          description: `Add ${Math.min(Math.ceil(visibilityGap * 0.3), 10)} high-authority directories`,
          priority: 'High',
          estimatedImpact: `Increase visibility by ${Math.round(visibilityGap * 0.2)}%`,
          effort: 'Medium',
          timeline: '1-3 months',
          metrics: {
            visibilityIncrease: Math.round(visibilityGap * 0.2),
            trafficIncrease: Math.round(visibilityGap * 0.15),
            leadIncrease: Math.round(visibilityGap * 0.12),
            revenuePotential: 3000
          }
        },
        {
          title: 'Optimize Existing Listings',
          description: 'Improve NAP consistency and add complete business information',
          priority: 'High',
          estimatedImpact: 'Improve local search rankings and trust',
          effort: 'Low',
          timeline: '1 month',
          metrics: {
            visibilityIncrease: 5,
            trafficIncrease: 8,
            leadIncrease: 6
          }
        }
      ],
      mediumTerm: [
        {
          title: 'Content Marketing Strategy',
          description: 'Create industry-specific content to build authority',
          priority: 'Medium',
          estimatedImpact: 'Increase organic traffic and engagement',
          effort: 'High',
          timeline: '3-6 months',
          metrics: {
            visibilityIncrease: 15,
            trafficIncrease: 25,
            leadIncrease: 20,
            revenuePotential: 8000
          }
        }
      ],
      longTerm: [
        {
          title: 'Market Leadership Position',
          description: 'Achieve top directory presence in industry',
          priority: 'Low',
          estimatedImpact: 'Become market leader in online visibility',
          effort: 'High',
          timeline: '6-12 months',
          metrics: {
            visibilityIncrease: 50,
            trafficIncrease: 80,
            leadIncrease: 60,
            revenuePotential: 25000
          }
        }
      ]
    }
  }

  /**
   * Create fallback projection
   */
  private createFallbackProjection(businessProfile: BusinessProfile): RevenueProjection {
    const currentState = {
      monthlyTraffic: this.estimateTraffic(businessProfile),
      monthlyLeads: this.estimateLeads(businessProfile),
      monthlyRevenue: this.estimateRevenue(businessProfile),
      conversionRate: 2.5
    }

    const projectedState = {
      monthlyTraffic: Math.round(currentState.monthlyTraffic * 1.3),
      monthlyLeads: Math.round(currentState.monthlyLeads * 1.3),
      monthlyRevenue: Math.round(currentState.monthlyRevenue * 1.3),
      conversionRate: currentState.conversionRate
    }

    return {
      currentState,
      projectedState,
      projection: {
        sixMonths: {
          monthlyTraffic: projectedState.monthlyTraffic,
          monthlyLeads: projectedState.monthlyLeads,
          monthlyRevenue: projectedState.monthlyRevenue,
          cumulativeRevenue: projectedState.monthlyRevenue * 6,
          visibilityIncrease: 30
        },
        twelveMonths: {
          monthlyTraffic: projectedState.monthlyTraffic,
          monthlyLeads: projectedState.monthlyLeads,
          monthlyRevenue: projectedState.monthlyRevenue,
          cumulativeRevenue: projectedState.monthlyRevenue * 12,
          visibilityIncrease: 30
        }
      },
      assumptions: [
        'Directory presence increases by 30%',
        'Traffic growth correlates with visibility increase',
        'Conversion rates remain stable'
      ]
    }
  }
}

// Export singleton instance
export const growthStrategyEngine = new GrowthStrategyEngine()
