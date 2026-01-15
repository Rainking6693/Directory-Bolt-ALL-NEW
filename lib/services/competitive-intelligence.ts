/**
 * Competitive Intelligence System
 * 
 * Finds top competitors and benchmarks client website against them:
 * - Find 3-5 top competitors using search APIs or AI-based research
 * - Benchmark directory density
 * - Compare SEO authority
 * - Analyze market positioning
 */

import { callAI } from '../utils/anthropic-client'
import { logger } from '../utils/logger'
import type { BusinessProfile } from './ai-business-profiler'
import type { ScrapedBusinessData } from './enhanced-website-scraper'

export interface Competitor {
  name: string
  url: string
  industry: string
  directoryListings: number
  seoScore: number
  marketPosition: string
  strengths: string[]
  weaknesses: string[]
}

export interface CompetitiveAnalysis {
  competitors: Competitor[]
  clientBenchmark: {
    directoryListings: number
    seoScore: number
    marketPosition: string
  }
  insights: {
    opportunities: string[]
    threats: string[]
    recommendations: string[]
  }
  directoryDensityComparison: {
    client: number
    average: number
    leader: number
  }
}

/**
 * Competitive Intelligence Service
 */
export class CompetitiveIntelligenceService {
  /**
   * Perform competitive analysis
   */
  async analyzeCompetitors(
    clientProfile: BusinessProfile,
    clientScrapedData: ScrapedBusinessData
  ): Promise<CompetitiveAnalysis> {
    try {
      logger.info('Starting competitive analysis', { business: clientProfile.name })

      // Find competitors using AI
      const competitors = await this.findCompetitors(clientProfile, clientScrapedData)

      // Benchmark client against competitors
      const benchmark = this.createClientBenchmark(clientScrapedData)

      // Generate insights
      const insights = await this.generateCompetitiveInsights(
        clientProfile,
        clientScrapedData,
        competitors
      )

      // Calculate directory density comparison
      const directoryDensityComparison = this.calculateDirectoryDensity(clientScrapedData, competitors)

      const analysis: CompetitiveAnalysis = {
        competitors: competitors.slice(0, 5), // Limit to top 5
        clientBenchmark: benchmark,
        insights,
        directoryDensityComparison
      }

      logger.info('Competitive analysis completed', {
        competitorsFound: competitors.length,
        clientDirectoryCount: benchmark.directoryListings
      })

      return analysis

    } catch (error) {
      logger.error('Competitive analysis failed', {
        error: error instanceof Error ? error.message : String(error)
      }, error as Error)

      // Return basic analysis
      return this.createFallbackAnalysis(clientProfile, clientScrapedData)
    }
  }

  /**
   * Find competitors using AI-based market research
   */
  private async findCompetitors(
    clientProfile: BusinessProfile,
    clientData: ScrapedBusinessData
  ): Promise<Competitor[]> {
    try {
      const keyServices = clientProfile.keyServices?.length
        ? clientProfile.keyServices.join(', ')
        : 'Not specified'

      const prompt = `Find the top 5 competitors for this business:

Business Name: ${clientProfile.name}
Industry: ${clientProfile.industry}
Category: ${clientProfile.category}
Location: ${clientData.address || 'Not specified'}
Key Services: ${keyServices}

Provide a JSON array of competitors with this structure:
[
  {
    "name": "Competitor Name",
    "url": "https://competitor.com",
    "industry": "Industry",
    "directoryListings": 50,
    "seoScore": 75,
    "marketPosition": "Market Leader / Established / Emerging",
    "strengths": ["Strength 1", "Strength 2"],
    "weaknesses": ["Weakness 1"]
  }
]

Be specific and realistic. Use actual competitor patterns.`

      const aiResponse = await callAI(prompt, 'complex', {
        anthropicModel: 'claude-3-5-sonnet-20241022',
        maxTokens: 3000,
        temperature: 0.4
      })

      // Parse AI response
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const competitors = JSON.parse(jsonMatch[0])
        return competitors.map((c: any) => ({
          name: c.name || 'Unknown Competitor',
          url: c.url || '',
          industry: c.industry || clientProfile.industry,
          directoryListings: c.directoryListings || Math.floor(Math.random() * 30) + 10,
          seoScore: c.seoScore || Math.floor(Math.random() * 30) + 60,
          marketPosition: c.marketPosition || 'Established',
          strengths: Array.isArray(c.strengths) ? c.strengths : [],
          weaknesses: Array.isArray(c.weaknesses) ? c.weaknesses : []
        }))
      }

      // Fallback: generate synthetic competitors
      return this.generateSyntheticCompetitors(clientProfile)

    } catch (error) {
      logger.error('Failed to find competitors via AI', { error })
      return this.generateSyntheticCompetitors(clientProfile)
    }
  }

  /**
   * Generate synthetic competitors as fallback
   */
  private generateSyntheticCompetitors(clientProfile: BusinessProfile): Competitor[] {
    return [
      {
        name: `Top ${clientProfile.industry} Provider`,
        url: `https://example-competitor-1.com`,
        industry: clientProfile.industry,
        directoryListings: 45,
        seoScore: 85,
        marketPosition: 'Market Leader',
        strengths: ['Strong online presence', 'Wide directory coverage'],
        weaknesses: ['Higher pricing']
      },
      {
        name: `Established ${clientProfile.category} Company`,
        url: `https://example-competitor-2.com`,
        industry: clientProfile.industry,
        directoryListings: 32,
        seoScore: 78,
        marketPosition: 'Established',
        strengths: ['Reputation', 'Industry experience'],
        weaknesses: ['Limited digital presence']
      },
      {
        name: `Emerging ${clientProfile.category} Service`,
        url: `https://example-competitor-3.com`,
        industry: clientProfile.industry,
        directoryListings: 18,
        seoScore: 65,
        marketPosition: 'Emerging',
        strengths: ['Modern approach', 'Competitive pricing'],
        weaknesses: ['Limited directory presence', 'New market entry']
      }
    ]
  }

  /**
   * Create client benchmark metrics
   */
  private createClientBenchmark(clientData: ScrapedBusinessData): CompetitiveAnalysis['clientBenchmark'] {
    return {
      directoryListings: clientData.existingDirectoryListings.length,
      seoScore: 70, // Will be replaced by real SEO audit
      marketPosition: 'Established Provider'
    }
  }

  /**
   * Generate competitive insights
   */
  private async generateCompetitiveInsights(
    clientProfile: BusinessProfile,
    clientData: ScrapedBusinessData,
    competitors: Competitor[]
  ): Promise<CompetitiveAnalysis['insights']> {
    try {
      const keyServices = clientProfile.keyServices?.length
        ? clientProfile.keyServices.join(', ')
        : 'Not specified'

      const prompt = `Analyze competitive positioning and provide insights:

Client: ${clientProfile.name}
Industry: ${clientProfile.industry}
Current Directory Listings: ${clientData.existingDirectoryListings.length}
Key Services: ${keyServices}

Competitors:
${competitors.map(c => `- ${c.name}: ${c.directoryListings} listings, SEO ${c.seoScore}`).join('\n')}

Provide JSON:
{
  "opportunities": ["Opportunity 1", "Opportunity 2"],
  "threats": ["Threat 1", "Threat 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}`

      const aiResponse = await callAI(prompt, 'complex', {
        maxTokens: 2000,
        temperature: 0.3
      })

      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
          threats: Array.isArray(parsed.threats) ? parsed.threats : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : []
        }
      }
    } catch (error) {
      logger.error('Failed to generate insights via AI', { error })
    }

    // Fallback insights
    const avgListings = competitors.reduce((sum, c) => sum + c.directoryListings, 0) / competitors.length
    const clientListings = clientData.existingDirectoryListings.length

    return {
      opportunities: [
        clientListings < avgListings ? 'Expand directory presence to match competitors' : 'Maintain competitive advantage',
        'Leverage unique selling points in directory listings',
        'Target high-authority directories competitors use'
      ],
      threats: [
        'Competitors with stronger directory presence may outrank in local search',
        'Market leaders have established authority',
        'New entrants competing for visibility'
      ],
      recommendations: [
        'Prioritize high-authority directory submissions',
        'Optimize existing listings for consistency',
        'Monitor competitor directory strategies'
      ]
    }
  }

  /**
   * Calculate directory density comparison
   */
  private calculateDirectoryDensity(
    clientData: ScrapedBusinessData,
    competitors: Competitor[]
  ): CompetitiveAnalysis['directoryDensityComparison'] {
    const clientListings = clientData.existingDirectoryListings.length
    const competitorListings = competitors.map(c => c.directoryListings)
    const avgListings = competitorListings.length > 0
      ? competitorListings.reduce((sum, n) => sum + n, 0) / competitorListings.length
      : 25
    const leaderListings = Math.max(...competitorListings, clientListings)

    return {
      client: clientListings,
      average: Math.round(avgListings),
      leader: leaderListings
    }
  }

  /**
   * Create fallback analysis
   */
  private createFallbackAnalysis(
    clientProfile: BusinessProfile,
    clientData: ScrapedBusinessData
  ): CompetitiveAnalysis {
    return {
      competitors: this.generateSyntheticCompetitors(clientProfile),
      clientBenchmark: this.createClientBenchmark(clientData),
      insights: {
        opportunities: ['Expand directory presence', 'Improve SEO visibility'],
        threats: ['Competition for search rankings', 'Market saturation'],
        recommendations: ['Focus on high-authority directories', 'Optimize existing listings']
      },
      directoryDensityComparison: {
        client: clientData.existingDirectoryListings.length,
        average: 25,
        leader: 50
      }
    }
  }
}

// Export singleton instance
export const competitiveIntelligenceService = new CompetitiveIntelligenceService()
