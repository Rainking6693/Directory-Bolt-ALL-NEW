import { callAI, isAnthropicAvailable, isGeminiAvailable } from '../utils/anthropic-client'
import { createClient } from '@supabase/supabase-js'

interface CompetitiveBenchmarkRequest {
  targetWebsite: string
  industry: string
  competitors?: string[]
  benchmarkingDepth: 'basic' | 'advanced' | 'comprehensive'
  includeTrafficEstimates: boolean
  includeContentStrategy: boolean
  includeTechnicalSEO: boolean
  includeBacklinkAnalysis: boolean
}

interface CompetitiveBenchmarkResult {
  targetWebsite: string
  industry: string
  overallScore: number
  ranking: number
  totalCompetitorsAnalyzed: number
  benchmarkSummary: {
    strengths: string[]
    weaknesses: string[]
    opportunities: string[]
    threats: string[]
  }
  competitorComparison: CompetitorBenchmark[]
  industryAverages: IndustryBenchmarks
  recommendations: RecommendationCategory[]
  analysisDate: string
  nextReviewDate: string
}

interface CompetitorBenchmark {
  domain: string
  companyName: string
  overallScore: number
  marketPosition: 'leader' | 'challenger' | 'follower' | 'niche'
  metrics: {
    trafficScore: number
    contentScore: number
    technicalScore: number
    backlinkScore: number
    socialScore: number
  }
  keyStrengths: string[]
  contentStrategy: {
    publishingFrequency: string
    averageContentLength: number
    topContentTypes: string[]
    keywordStrategy: string
  }
  technicalSEO: {
    pageSpeed: number
    mobileOptimization: number
    coreWebVitals: number
    indexability: number
  }
  differentiators: string[]
}

interface IndustryBenchmarks {
  averageTrafficScore: number
  averageContentScore: number
  averageTechnicalScore: number
  averageBacklinkScore: number
  industryLeaders: string[]
  emergingTrends: string[]
  commonPainPoints: string[]
  opportunityAreas: string[]
}

interface RecommendationCategory {
  category: 'content' | 'technical' | 'backlinks' | 'user-experience' | 'strategy'
  priority: 'critical' | 'high' | 'medium' | 'low'
  recommendations: DetailedRecommendation[]
}

interface DetailedRecommendation {
  title: string
  description: string
  implementation: string
  estimatedImpact: 'high' | 'medium' | 'low'
  timeToImplement: string
  resourcesRequired: string[]
  competitors: string[]
  successMetrics: string[]
}

export class CompetitiveBenchmarkingService {
  private supabase: any

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  async performBenchmarkAnalysis(request: CompetitiveBenchmarkRequest): Promise<CompetitiveBenchmarkResult> {
    try {
      // Step 1: Identify industry competitors if not provided
      const competitors = request.competitors?.length 
        ? request.competitors 
        : await this.discoverIndustryCompetitors(request.targetWebsite, request.industry)

      // Step 2: Analyze each competitor
      const competitorAnalyses = await Promise.all(
        competitors.slice(0, 10).map(competitor => 
          this.analyzeCompetitor(competitor, request)
        )
      )

      // Step 3: Calculate industry benchmarks
      const industryBenchmarks = await this.calculateIndustryBenchmarks(
        competitorAnalyses, 
        request.industry
      )

      // Step 4: Perform target website analysis
      const targetAnalysis = await this.analyzeCompetitor(request.targetWebsite, request)

      // Step 5: Generate comparative insights and recommendations
      const benchmarkResult = await this.generateBenchmarkInsights(
        targetAnalysis,
        competitorAnalyses,
        industryBenchmarks,
        request
      )

      // Step 6: Store results for future reference
      await this.storeBenchmarkResults(benchmarkResult)

      return benchmarkResult

    } catch (error) {
      console.error('Competitive benchmarking failed:', error)
      throw new Error(`Benchmarking analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async discoverIndustryCompetitors(targetWebsite: string, industry: string): Promise<string[]> {
    const prompt = `
      Identify 8-10 main competitors for ${targetWebsite} in the ${industry} industry.
      
      Requirements:
      - Focus on direct competitors offering similar products/services
      - Include both established leaders and emerging challengers
      - Prioritize competitors with strong online presence
      - Return only domain names (e.g., example.com)
      
      Return as a JSON array of domain names.
    `

    // Use Gemini for simple competitor discovery
    try {
      const response = await callAI(prompt, 'simple', {
        geminiModel: 'gemini-pro',
        maxTokens: 500,
        temperature: 0.3
      })

      const jsonMatch = response.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const competitors = JSON.parse(jsonMatch[0])
        return Array.isArray(competitors) ? competitors : []
      }
      return []
    } catch {
      return []
    }
  }

  private async analyzeCompetitor(domain: string, request: CompetitiveBenchmarkRequest): Promise<CompetitorBenchmark> {
    // Simulated comprehensive competitor analysis
    // In production, integrate with SEO tools like Ahrefs, SEMrush, or similar APIs
    
    const prompt = `
      Perform a comprehensive competitive analysis for ${domain} in the ${request.industry} industry.
      
      Analyze these aspects:
      ${request.includeTrafficEstimates ? '- Traffic patterns and growth trends' : ''}
      ${request.includeContentStrategy ? '- Content strategy and publishing patterns' : ''}
      ${request.includeTechnicalSEO ? '- Technical SEO performance' : ''}
      ${request.includeBacklinkAnalysis ? '- Backlink profile quality' : ''}
      
      Provide detailed insights on:
      1. Overall market position and competitive strength
      2. Key differentiators and unique value propositions
      3. Content strategy effectiveness
      4. Technical SEO performance
      5. Areas of strength and weakness
      
      Return detailed analysis in JSON format matching the CompetitorBenchmark interface.
    `

    try {
      const response = await callAI(prompt, 'complex', {
        anthropicModel: 'claude-3-sonnet-20241022',
        maxTokens: 2000,
        temperature: 0.3
      })

      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0])
        return {
          domain,
          companyName: analysis.companyName || this.formatCompanyName(domain),
          overallScore: analysis.overallScore || 75,
          marketPosition: analysis.marketPosition || 'follower',
          metrics: analysis.metrics || {
            trafficScore: 70,
            contentScore: 65,
            technicalScore: 75,
            backlinkScore: 60,
            socialScore: 55
          },
          keyStrengths: analysis.keyStrengths || analysis.strengths || [],
          contentStrategy: analysis.contentStrategy || {
            publishingFrequency: 'Weekly',
            averageContentLength: 1500,
            topContentTypes: ['Blog posts'],
            keywordStrategy: 'Broad targeting'
          },
          technicalSEO: analysis.technicalSEO || {
            pageSpeed: 75,
            mobileOptimization: 80,
            coreWebVitals: 70,
            indexability: 85
          },
          differentiators: analysis.differentiators || analysis.keyDifferentiators || []
        }
      }
    } catch (error) {
      console.error(`Failed to analyze competitor ${domain}:`, error)
    }

    // Fallback return when analysis fails
    return {
      domain,
      companyName: this.formatCompanyName(domain),
      overallScore: 50,
      marketPosition: 'follower',
      metrics: {
        trafficScore: 50,
        contentScore: 50,
        technicalScore: 50,
        backlinkScore: 50,
        socialScore: 50
      },
      keyStrengths: [],
      contentStrategy: {
        publishingFrequency: 'Unknown',
        averageContentLength: 1000,
        topContentTypes: [],
        keywordStrategy: 'Unknown'
      },
      technicalSEO: {
        pageSpeed: 50,
        mobileOptimization: 50,
        coreWebVitals: 50,
        indexability: 50
      },
      differentiators: ['Analysis temporarily unavailable']
    }
  }

  private async calculateIndustryBenchmarks(
    competitorAnalyses: CompetitorBenchmark[], 
    industry: string
  ): Promise<IndustryBenchmarks> {
    const trafficScores = competitorAnalyses.map(c => c.metrics.trafficScore)
    const contentScores = competitorAnalyses.map(c => c.metrics.contentScore)
    const technicalScores = competitorAnalyses.map(c => c.metrics.technicalScore)
    const backlinkScores = competitorAnalyses.map(c => c.metrics.backlinkScore)

    const industryLeaders = competitorAnalyses
      .filter(c => c.marketPosition === 'leader')
      .map(c => c.companyName)

    return {
      averageTrafficScore: Math.round(trafficScores.reduce((a, b) => a + b, 0) / trafficScores.length),
      averageContentScore: Math.round(contentScores.reduce((a, b) => a + b, 0) / contentScores.length),
      averageTechnicalScore: Math.round(technicalScores.reduce((a, b) => a + b, 0) / technicalScores.length),
      averageBacklinkScore: Math.round(backlinkScores.reduce((a, b) => a + b, 0) / backlinkScores.length),
      industryLeaders: industryLeaders.length > 0 ? industryLeaders : [competitorAnalyses[0]?.companyName || 'Unknown'],
      emergingTrends: [
        "AI-powered content optimization",
        "Voice search optimization",
        "Video content integration",
        "Local SEO enhancement"
      ],
      commonPainPoints: [
        "Content production scalability",
        "Technical SEO complexity",
        "Link building challenges",
        "Algorithm update impacts"
      ],
      opportunityAreas: [
        "Emerging keyword opportunities",
        "Content format diversification",
        "Technical optimization gaps",
        "User experience improvements"
      ]
    }
  }

  private async generateBenchmarkInsights(
    targetAnalysis: CompetitorBenchmark,
    competitorAnalyses: CompetitorBenchmark[],
    industryBenchmarks: IndustryBenchmarks,
    request: CompetitiveBenchmarkRequest
  ): Promise<CompetitiveBenchmarkResult> {
    // Calculate target's ranking
    const allScores = [...competitorAnalyses, targetAnalysis]
      .sort((a, b) => b.overallScore - a.overallScore)
    
    const targetRanking = allScores.findIndex(c => c.domain === request.targetWebsite) + 1

    const prompt = `
      Generate comprehensive competitive insights and recommendations based on this analysis:
      
      Target Website: ${request.targetWebsite}
      Target Score: ${targetAnalysis.overallScore}
      Industry Ranking: ${targetRanking} out of ${allScores.length}
      Industry Averages: ${JSON.stringify(industryBenchmarks, null, 2)}
      
      Competitor Performance:
      ${competitorAnalyses.map(c => `${c.domain}: ${c.overallScore} (${c.marketPosition})`).join('\n')}
      
      Generate:
      1. SWOT analysis (Strengths, Weaknesses, Opportunities, Threats)
      2. Prioritized recommendations across content, technical, backlinks, UX, and strategy
      3. Specific implementation guidance with timeframes and resource requirements
      
      Focus on actionable insights that can drive measurable improvements.
      Return as JSON matching the expected structure.
    `

    // Use Anthropic for complex benchmark insights generation
    try {
      const response = await callAI(prompt, 'complex', {
        anthropicModel: 'claude-3-sonnet-20241022',
        maxTokens: 3000,
        temperature: 0.3,
        systemPrompt: 'You are an expert competitive intelligence analyst. Provide strategic benchmark insights in JSON format.'
      })

      const jsonMatch = response.match(/\{[\s\S]*\}/)
      const insights = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
      
      const nextReviewDate = new Date()
      nextReviewDate.setMonth(nextReviewDate.getMonth() + 3)

      return {
        targetWebsite: request.targetWebsite,
        industry: request.industry,
        overallScore: targetAnalysis.overallScore,
        ranking: targetRanking,
        totalCompetitorsAnalyzed: competitorAnalyses.length,
        benchmarkSummary: insights.benchmarkSummary || {
          strengths: ["Competitive analysis completed"],
          weaknesses: ["Areas for improvement identified"],
          opportunities: ["Market gaps discovered"],
          threats: ["Competitive pressures noted"]
        },
        competitorComparison: competitorAnalyses,
        industryAverages: industryBenchmarks,
        recommendations: insights.recommendations || [],
        analysisDate: new Date().toISOString(),
        nextReviewDate: nextReviewDate.toISOString()
      }
    } catch {
      // Fallback result structure
      const nextReviewDate = new Date()
      nextReviewDate.setMonth(nextReviewDate.getMonth() + 3)

      return {
        targetWebsite: request.targetWebsite,
        industry: request.industry,
        overallScore: targetAnalysis.overallScore,
        ranking: targetRanking,
        totalCompetitorsAnalyzed: competitorAnalyses.length,
        benchmarkSummary: {
          strengths: ["Established market presence", "Technical foundation"],
          weaknesses: ["Content strategy gaps", "SEO optimization opportunities"],
          opportunities: ["Emerging market trends", "Content diversification"],
          threats: ["Competitor advancement", "Algorithm changes"]
        },
        competitorComparison: competitorAnalyses,
        industryAverages: industryBenchmarks,
        recommendations: [
          {
            category: 'content',
            priority: 'high',
            recommendations: [
              {
                title: "Enhance Content Strategy",
                description: "Develop comprehensive content plan based on competitor analysis",
                implementation: "Create editorial calendar with topic clusters and publishing schedule",
                estimatedImpact: 'high',
                timeToImplement: "2-3 months",
                resourcesRequired: ["Content team", "SEO tools", "Analytics platform"],
                competitors: competitorAnalyses.slice(0, 3).map(c => c.domain),
                successMetrics: ["Organic traffic growth", "Content engagement", "Keyword rankings"]
              }
            ]
          }
        ],
        analysisDate: new Date().toISOString(),
        nextReviewDate: nextReviewDate.toISOString()
      }
    }
  }

  private async storeBenchmarkResults(result: CompetitiveBenchmarkResult): Promise<void> {
    try {
      await this.supabase
        .from('competitive_benchmarks')
        .insert({
          target_website: result.targetWebsite,
          industry: result.industry,
          overall_score: result.overallScore,
          ranking: result.ranking,
          analysis_data: result,
          created_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('Failed to store benchmark results:', error)
      // Don't throw - this is optional storage
    }
  }

  async getBenchmarkHistory(website: string, limit: number = 10): Promise<CompetitiveBenchmarkResult[]> {
    try {
      const { data, error } = await this.supabase
        .from('competitive_benchmarks')
        .select('analysis_data')
        .eq('target_website', website)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      return data?.map((row: any) => row.analysis_data) || []
    } catch (error) {
      console.error('Failed to fetch benchmark history:', error)
      return []
    }
  }

  private formatCompanyName(domain: string): string {
    return domain
      .replace(/\.(com|org|net|io|co)$/, '')
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }
}

export const competitiveBenchmarkingService = new CompetitiveBenchmarkingService()
