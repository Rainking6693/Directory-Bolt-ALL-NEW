// 🤖 ENHANCED AI BUSINESS ANALYZER SERVICE
// Complete business intelligence and competitive analysis using OpenAI GPT-4

import OpenAI from 'openai'
import { logger } from '../utils/logger'
import type { 
  BusinessProfile, 
  CompetitiveAnalysis, 
  SEOAnalysis, 
  MarketInsights, 
  AIInsights,
  RevenueProjection,
  Competitor,
  DirectoryOpportunity
} from '../types/ai.types'

interface WebsiteData {
  title?: string
  description?: string
  content?: string
  url: string
  screenshots?: string[]
  socialMediaLinks?: string[]
  contactInfo?: {
    email?: string
    phone?: string
    address?: string
  }
  metaData?: {
    keywords?: string[]
    author?: string
    language?: string
  }
  technicalData?: {
    loadTime?: number
    mobileOptimized?: boolean
    httpsEnabled?: boolean
    hasStructuredData?: boolean
  }
}

export class EnhancedAIBusinessAnalyzer {
  private static instance: EnhancedAIBusinessAnalyzer
  private openai: OpenAI | null = null
  private isInitialized = false
  private analysisCache = new Map<string, AIInsights>()

  private constructor() {
    this.initializeOpenAI()
  }

  public static getInstance(): EnhancedAIBusinessAnalyzer {
    if (!EnhancedAIBusinessAnalyzer.instance) {
      EnhancedAIBusinessAnalyzer.instance = new EnhancedAIBusinessAnalyzer()
    }
    return EnhancedAIBusinessAnalyzer.instance
  }

  private initializeOpenAI(): void {
    try {
      const apiKey = process.env.OPENAI_API_KEY
      
      if (!apiKey) {
        logger.warn('OpenAI API key not found. AI analysis will use fallback data.')
        return
      }

      this.openai = new OpenAI({
        apiKey: apiKey
      })
      
      this.isInitialized = true
      logger.info('Enhanced OpenAI client initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize OpenAI client', {}, error as Error)
    }
  }

  /**
   * Generate complete AI business intelligence analysis
   */
  async generateCompleteIntelligence(websiteData: WebsiteData): Promise<AIInsights> {
    try {
      const cacheKey = websiteData.url
      
      // Check cache first
      if (this.analysisCache.has(cacheKey)) {
        logger.info('Returning cached AI intelligence', { url: websiteData.url })
        return this.analysisCache.get(cacheKey)!
      }
      
      logger.info('Generating complete AI business intelligence', { url: websiteData.url })
      
      // Generate all analysis components in parallel
      const [businessProfile, competitiveAnalysis, seoAnalysis, marketInsights, revenueProjections] = await Promise.all([
        this.analyzeBusinessProfile(websiteData),
        this.generateCompetitiveAnalysis(websiteData),
        this.generateSEOAnalysis(websiteData),
        this.generateMarketInsights(websiteData),
        this.generateRevenueProjections(websiteData)
      ])
      
      const actionableRecommendations = this.generateActionableRecommendations(
        businessProfile, competitiveAnalysis, seoAnalysis, marketInsights
      )
      
      const intelligence: AIInsights = {
        businessProfile,
        marketInsights,
        competitiveAnalysis,
        seoAnalysis,
        revenueProjections,
        actionableRecommendations,
        priorityScore: this.calculatePriorityScore(businessProfile, competitiveAnalysis, seoAnalysis),
        confidenceLevel: this.isInitialized ? 0.88 : 0.65
      }
      
      // Cache the result for 1 hour
      this.analysisCache.set(cacheKey, intelligence)
      setTimeout(() => this.analysisCache.delete(cacheKey), 3600000)
      
      logger.info('Complete AI intelligence generation completed', {
        url: websiteData.url,
        confidenceLevel: intelligence.confidenceLevel,
        priorityScore: intelligence.priorityScore
      })
      
      return intelligence
      
    } catch (error) {
      logger.error('AI intelligence generation failed', {}, error as Error)
      return this.generateFallbackIntelligence(websiteData)
    }
  }

  /**
   * Analyze business profile with AI
   */
  private async analyzeBusinessProfile(websiteData: WebsiteData): Promise<BusinessProfile> {
    try {
      if (this.isInitialized && this.openai) {
        const prompt = this.createBusinessProfilePrompt(websiteData)
        
        const completion = await this.openai.chat.completions.create({
          model: "gpt-4",
          messages: [{
            role: "system",
            content: "You are an expert business analyst with 20+ years of experience. Analyze the provided website data and return a comprehensive business profile in valid JSON format. Focus on accuracy and actionable insights."
          }, {
            role: "user",
            content: prompt
          }],
          temperature: 0.2,
          max_tokens: 2000
        })
        
        const aiResponse = completion.choices[0]?.message?.content
        if (aiResponse) {
          try {
            const parsedProfile = JSON.parse(aiResponse)
            return this.validateBusinessProfile(parsedProfile, websiteData)
          } catch (parseError) {
            logger.warn('Failed to parse AI business profile response')
          }
        }
      }
      
      return this.generateFallbackBusinessProfile(websiteData)
      
    } catch (error) {
      logger.error('Business profile analysis failed', {}, error as Error)
      return this.generateFallbackBusinessProfile(websiteData)
    }
  }

  /**
   * Generate competitive analysis with AI
   */
  private async generateCompetitiveAnalysis(websiteData: WebsiteData): Promise<CompetitiveAnalysis> {
    try {
      if (this.isInitialized && this.openai) {
        const prompt = this.createCompetitiveAnalysisPrompt(websiteData)
        
        const completion = await this.openai.chat.completions.create({
          model: "gpt-4",
          messages: [{
            role: "system",
            content: "You are a competitive intelligence expert. Analyze the business and provide comprehensive competitive analysis in valid JSON format."
          }, {
            role: "user",
            content: prompt
          }],
          temperature: 0.3,
          max_tokens: 2500
        })
        
        const aiResponse = completion.choices[0]?.message?.content
        if (aiResponse) {
          try {
            const parsedAnalysis = JSON.parse(aiResponse)
            return this.validateCompetitiveAnalysis(parsedAnalysis)
          } catch (parseError) {
            logger.warn('Failed to parse AI competitive analysis response')
          }
        }
      }
      
      return this.generateFallbackCompetitiveAnalysis(websiteData)
      
    } catch (error) {
      logger.error('Competitive analysis failed', {}, error as Error)
      return this.generateFallbackCompetitiveAnalysis(websiteData)
    }
  }

  /**
   * Generate SEO analysis with AI
   */
  private async generateSEOAnalysis(websiteData: WebsiteData): Promise<SEOAnalysis> {
    try {
      if (this.isInitialized && this.openai) {
        const prompt = this.createSEOAnalysisPrompt(websiteData)
        
        const completion = await this.openai.chat.completions.create({
          model: "gpt-4",
          messages: [{
            role: "system",
            content: "You are an SEO expert with deep knowledge of technical SEO, content optimization, and local SEO. Provide comprehensive SEO analysis in valid JSON format."
          }, {
            role: "user",
            content: prompt
          }],
          temperature: 0.2,
          max_tokens: 2000
        })
        
        const aiResponse = completion.choices[0]?.message?.content
        if (aiResponse) {
          try {
            const parsedAnalysis = JSON.parse(aiResponse)
            return this.validateSEOAnalysis(parsedAnalysis)
          } catch (parseError) {
            logger.warn('Failed to parse AI SEO analysis response')
          }
        }
      }
      
      return this.generateFallbackSEOAnalysis(websiteData)
      
    } catch (error) {
      logger.error('SEO analysis failed', {}, error as Error)
      return this.generateFallbackSEOAnalysis(websiteData)
    }
  }

  /**
   * Generate market insights with AI
   */
  private async generateMarketInsights(websiteData: WebsiteData): Promise<MarketInsights> {
    try {
      if (this.isInitialized && this.openai) {
        const prompt = this.createMarketInsightsPrompt(websiteData)
        
        const completion = await this.openai.chat.completions.create({
          model: "gpt-4",
          messages: [{
            role: "system",
            content: "You are a market research expert with deep industry knowledge. Provide comprehensive market insights in valid JSON format."
          }, {
            role: "user",
            content: prompt
          }],
          temperature: 0.3,
          max_tokens: 2000
        })
        
        const aiResponse = completion.choices[0]?.message?.content
        if (aiResponse) {
          try {
            const parsedInsights = JSON.parse(aiResponse)
            return this.validateMarketInsights(parsedInsights)
          } catch (parseError) {
            logger.warn('Failed to parse AI market insights response')
          }
        }
      }
      
      return this.generateFallbackMarketInsights(websiteData)
      
    } catch (error) {
      logger.error('Market insights generation failed', {}, error as Error)
      return this.generateFallbackMarketInsights(websiteData)
    }
  }

  /**
   * Generate revenue projections with AI
   */
  private async generateRevenueProjections(websiteData: WebsiteData): Promise<RevenueProjection> {
    try {
      if (this.isInitialized && this.openai) {
        const prompt = this.createRevenueProjectionPrompt(websiteData)
        
        const completion = await this.openai.chat.completions.create({
          model: "gpt-4",
          messages: [{
            role: "system",
            content: "You are a financial analyst specializing in business growth projections. Provide realistic revenue projections in valid JSON format."
          }, {
            role: "user",
            content: prompt
          }],
          temperature: 0.2,
          max_tokens: 1500
        })
        
        const aiResponse = completion.choices[0]?.message?.content
        if (aiResponse) {
          try {
            const parsedProjections = JSON.parse(aiResponse)
            return this.validateRevenueProjections(parsedProjections)
          } catch (parseError) {
            logger.warn('Failed to parse AI revenue projections response')
          }
        }
      }
      
      return this.generateFallbackRevenueProjections(websiteData)
      
    } catch (error) {
      logger.error('Revenue projections generation failed', {}, error as Error)
      return this.generateFallbackRevenueProjections(websiteData)
    }
  }

  // Prompt creation methods
  private createBusinessProfilePrompt(websiteData: WebsiteData): string {
    return `Analyze this business website and provide a detailed business profile:

Website URL: ${websiteData.url}
Title: ${websiteData.title || 'N/A'}
Description: ${websiteData.description || 'N/A'}
Content Sample: ${websiteData.content?.substring(0, 1500) || 'N/A'}
Social Media: ${websiteData.socialMediaLinks?.join(', ') || 'N/A'}
Contact Info: ${JSON.stringify(websiteData.contactInfo) || 'N/A'}

Return a JSON object with this exact structure:
{
  "name": "Business name",
  "industry": "Primary industry",
  "category": "Business category (B2B, B2C, B2B2C, etc.)",
  "description": "Clear 2-3 sentence business description",
  "targetAudience": ["primary audience", "secondary audience"],
  "businessModel": "Business model (SaaS, E-commerce, Service, etc.)",
  "location": "Primary location or 'Global'",
  "website": "${websiteData.url}",
  "foundingYear": estimated_year_or_null,
  "employeeCount": "estimated range (1-10, 11-50, etc.)",
  "revenue": "estimated range or null",
  "keyProducts": ["product1", "product2"],
  "keyServices": ["service1", "service2"],
  "uniqueSellingProposition": "What makes them unique",
  "marketPosition": "Market position description"
}`
  }

  private createCompetitiveAnalysisPrompt(websiteData: WebsiteData): string {
    return `Analyze the competitive landscape for this business:

Website: ${websiteData.url}
Business Info: ${websiteData.title} - ${websiteData.description}
Content: ${websiteData.content?.substring(0, 1000) || 'N/A'}

Return a JSON object with this structure:
{
  "marketPosition": "Current market position description",
  "competitiveAdvantages": ["advantage1", "advantage2", "advantage3"],
  "competitiveDisadvantages": ["disadvantage1", "disadvantage2"],
  "keyCompetitors": [
    {
      "name": "Competitor name",
      "website": "competitor-url.com",
      "marketPosition": "Their position",
      "strengths": ["strength1", "strength2"],
      "weaknesses": ["weakness1", "weakness2"],
      "marketShare": estimated_percentage_or_null,
      "pricingStrategy": "pricing approach",
      "keyDifferentiators": ["differentiator1", "differentiator2"]
    }
  ],
  "marketShare": estimated_percentage_or_null,
  "competitiveGaps": ["gap1", "gap2"],
  "opportunityAreas": ["opportunity1", "opportunity2"],
  "threatAnalysis": ["threat1", "threat2"],
  "recommendedStrategies": ["strategy1", "strategy2", "strategy3"]
}`
  }

  private createSEOAnalysisPrompt(websiteData: WebsiteData): string {
    return `Analyze the SEO potential and current state for this website:

URL: ${websiteData.url}
Title: ${websiteData.title}
Description: ${websiteData.description}
Technical Data: ${JSON.stringify(websiteData.technicalData)}
Content: ${websiteData.content?.substring(0, 1000)}

Return a JSON object with this structure:
{
  "currentScore": score_out_of_100,
  "technicalSEO": {
    "score": score_out_of_100,
    "issues": ["issue1", "issue2"],
    "recommendations": ["rec1", "rec2"]
  },
  "contentSEO": {
    "score": score_out_of_100,
    "keywordOpportunities": ["keyword1", "keyword2"],
    "contentGaps": ["gap1", "gap2"],
    "recommendations": ["rec1", "rec2"]
  },
  "localSEO": {
    "score": score_out_of_100,
    "currentListings": estimated_number,
    "missedOpportunities": estimated_number,
    "recommendations": ["rec1", "rec2"]
  },
  "improvementAreas": ["area1", "area2", "area3"],
  "priorityActions": ["action1", "action2", "action3"],
  "estimatedImpact": {
    "trafficIncrease": percentage_increase,
    "rankingImprovement": percentage_improvement,
    "timeframe": "3-6 months"
  }
}`
  }

  private createMarketInsightsPrompt(websiteData: WebsiteData): string {
    return `Provide market insights for this business:

Business: ${websiteData.title}
Industry Context: ${websiteData.description}
URL: ${websiteData.url}

Return a JSON object with this structure:
{
  "marketSize": "Market size description",
  "growthRate": annual_growth_percentage,
  "marketTrends": ["trend1", "trend2", "trend3"],
  "customerBehavior": ["behavior1", "behavior2"],
  "seasonalFactors": ["factor1", "factor2"],
  "emergingOpportunities": ["opportunity1", "opportunity2"],
  "marketChallenges": ["challenge1", "challenge2"],
  "recommendedTiming": ["timing1", "timing2"]
}`
  }

  private createRevenueProjectionPrompt(websiteData: WebsiteData): string {
    return `Create realistic revenue projections for directory submission impact:

Business: ${websiteData.title}
Description: ${websiteData.description}
URL: ${websiteData.url}

Return a JSON object with this structure:
{
  "timeframe": "6 months",
  "conservative": {
    "projectedRevenue": dollar_amount,
    "trafficIncrease": percentage,
    "leadIncrease": percentage,
    "conversionRate": percentage,
    "confidence": percentage
  },
  "optimistic": {
    "projectedRevenue": dollar_amount,
    "trafficIncrease": percentage,
    "leadIncrease": percentage,
    "conversionRate": percentage,
    "confidence": percentage
  },
  "assumptions": ["assumption1", "assumption2"],
  "keyFactors": ["factor1", "factor2"]
}`
  }

  // Validation methods
  private validateBusinessProfile(profile: any, websiteData: WebsiteData): BusinessProfile {
    return {
      name: profile.name || this.extractBusinessName(websiteData),
      industry: profile.industry || 'Technology',
      category: profile.category || 'B2B',
      description: profile.description || websiteData.description || 'Business description not available',
      targetAudience: Array.isArray(profile.targetAudience) ? profile.targetAudience : ['Business owners'],
      businessModel: profile.businessModel || 'Service',
      location: profile.location || 'United States',
      website: websiteData.url,
      foundingYear: profile.foundingYear || null,
      employeeCount: profile.employeeCount || '1-10',
      revenue: profile.revenue || null,
      keyProducts: Array.isArray(profile.keyProducts) ? profile.keyProducts : [],
      keyServices: Array.isArray(profile.keyServices) ? profile.keyServices : [],
      uniqueSellingProposition: profile.uniqueSellingProposition || 'Unique business solution',
      marketPosition: profile.marketPosition || 'Emerging player in the market'
    }
  }

  private validateCompetitiveAnalysis(analysis: any): CompetitiveAnalysis {
    return {
      marketPosition: analysis.marketPosition || 'Emerging player in competitive market',
      competitiveAdvantages: Array.isArray(analysis.competitiveAdvantages) ? analysis.competitiveAdvantages : ['Unique value proposition'],
      competitiveDisadvantages: Array.isArray(analysis.competitiveDisadvantages) ? analysis.competitiveDisadvantages : ['Limited market presence'],
      keyCompetitors: Array.isArray(analysis.keyCompetitors) ? analysis.keyCompetitors : [],
      marketShare: analysis.marketShare || null,
      competitiveGaps: Array.isArray(analysis.competitiveGaps) ? analysis.competitiveGaps : ['Market education needed'],
      opportunityAreas: Array.isArray(analysis.opportunityAreas) ? analysis.opportunityAreas : ['Digital marketing expansion'],
      threatAnalysis: Array.isArray(analysis.threatAnalysis) ? analysis.threatAnalysis : ['Increased competition'],
      recommendedStrategies: Array.isArray(analysis.recommendedStrategies) ? analysis.recommendedStrategies : ['Focus on differentiation']
    }
  }

  private validateSEOAnalysis(analysis: any): SEOAnalysis {
    return {
      currentScore: analysis.currentScore || 65,
      technicalSEO: {
        score: analysis.technicalSEO?.score || 70,
        issues: Array.isArray(analysis.technicalSEO?.issues) ? analysis.technicalSEO.issues : ['Page speed optimization needed'],
        recommendations: Array.isArray(analysis.technicalSEO?.recommendations) ? analysis.technicalSEO.recommendations : ['Improve site speed']
      },
      contentSEO: {
        score: analysis.contentSEO?.score || 60,
        keywordOpportunities: Array.isArray(analysis.contentSEO?.keywordOpportunities) ? analysis.contentSEO.keywordOpportunities : ['Industry-specific keywords'],
        contentGaps: Array.isArray(analysis.contentSEO?.contentGaps) ? analysis.contentSEO.contentGaps : ['Blog content needed'],
        recommendations: Array.isArray(analysis.contentSEO?.recommendations) ? analysis.contentSEO.recommendations : ['Create valuable content']
      },
      localSEO: {
        score: analysis.localSEO?.score || 45,
        currentListings: analysis.localSEO?.currentListings || 5,
        missedOpportunities: analysis.localSEO?.missedOpportunities || 25,
        recommendations: Array.isArray(analysis.localSEO?.recommendations) ? analysis.localSEO.recommendations : ['Increase directory presence']
      },
      improvementAreas: Array.isArray(analysis.improvementAreas) ? analysis.improvementAreas : ['Content optimization', 'Technical SEO'],
      priorityActions: Array.isArray(analysis.priorityActions) ? analysis.priorityActions : ['Directory submissions', 'Content creation'],
      estimatedImpact: {
        trafficIncrease: analysis.estimatedImpact?.trafficIncrease || 150,
        rankingImprovement: analysis.estimatedImpact?.rankingImprovement || 25,
        timeframe: analysis.estimatedImpact?.timeframe || '3-6 months'
      }
    }
  }

  private validateMarketInsights(insights: any): MarketInsights {
    return {
      marketSize: insights.marketSize || 'Growing market with significant opportunity',
      growthRate: insights.growthRate || 8.5,
      marketTrends: Array.isArray(insights.marketTrends) ? insights.marketTrends : ['Digital transformation', 'Remote work adoption'],
      customerBehavior: Array.isArray(insights.customerBehavior) ? insights.customerBehavior : ['Online research before purchase'],
      seasonalFactors: Array.isArray(insights.seasonalFactors) ? insights.seasonalFactors : ['Q4 increased activity'],
      emergingOpportunities: Array.isArray(insights.emergingOpportunities) ? insights.emergingOpportunities : ['AI integration', 'Mobile optimization'],
      marketChallenges: Array.isArray(insights.marketChallenges) ? insights.marketChallenges : ['Increased competition'],
      recommendedTiming: Array.isArray(insights.recommendedTiming) ? insights.recommendedTiming : ['Q1 launch optimal']
    }
  }

  private validateRevenueProjections(projections: any): RevenueProjection {
    return {
      timeframe: projections.timeframe || '6 months',
      conservative: {
        projectedRevenue: projections.conservative?.projectedRevenue || 25000,
        trafficIncrease: projections.conservative?.trafficIncrease || 120,
        leadIncrease: projections.conservative?.leadIncrease || 85,
        conversionRate: projections.conservative?.conversionRate || 2.5,
        confidence: projections.conservative?.confidence || 75
      },
      optimistic: {
        projectedRevenue: projections.optimistic?.projectedRevenue || 45000,
        trafficIncrease: projections.optimistic?.trafficIncrease || 220,
        leadIncrease: projections.optimistic?.leadIncrease || 150,
        conversionRate: projections.optimistic?.conversionRate || 3.8,
        confidence: projections.optimistic?.confidence || 60
      },
      assumptions: Array.isArray(projections.assumptions) ? projections.assumptions : ['Consistent marketing effort', 'Market conditions remain stable'],
      keyFactors: Array.isArray(projections.keyFactors) ? projections.keyFactors : ['Directory submission success', 'SEO improvements']
    }
  }

  // Fallback generation methods
  private generateFallbackBusinessProfile(websiteData: WebsiteData): BusinessProfile {
    const domain = new URL(websiteData.url).hostname
    const businessName = this.extractBusinessName(websiteData)
    
    return {
      name: businessName,
      industry: this.inferIndustry(websiteData),
      category: 'B2B',
      description: websiteData.description || `${businessName} provides professional services and solutions.`,
      targetAudience: ['Business owners', 'Professionals'],
      businessModel: 'Service',
      location: 'United States',
      website: websiteData.url,
      foundingYear: undefined,
      employeeCount: '1-10',
      revenue: undefined,
      keyProducts: [],
      keyServices: ['Professional services', 'Consulting'],
      uniqueSellingProposition: 'Dedicated to providing quality solutions',
      marketPosition: 'Emerging player in the market'
    }
  }

  private generateFallbackCompetitiveAnalysis(websiteData: WebsiteData): CompetitiveAnalysis {
    return {
      marketPosition: 'Emerging player in competitive market',
      competitiveAdvantages: ['Personalized service', 'Local expertise', 'Competitive pricing'],
      competitiveDisadvantages: ['Limited market presence', 'Smaller scale operations'],
      keyCompetitors: [],
      marketShare: undefined,
      competitiveGaps: ['Digital marketing presence', 'Online visibility'],
      opportunityAreas: ['Directory submissions', 'Content marketing', 'SEO optimization'],
      threatAnalysis: ['Increased competition', 'Market saturation'],
      recommendedStrategies: ['Increase online presence', 'Focus on differentiation', 'Expand directory listings']
    }
  }

  private generateFallbackSEOAnalysis(websiteData: WebsiteData): SEOAnalysis {
    return {
      currentScore: 55,
      technicalSEO: {
        score: 65,
        issues: ['Page speed optimization needed', 'Mobile responsiveness improvements'],
        recommendations: ['Optimize images', 'Improve site speed', 'Enhance mobile experience']
      },
      contentSEO: {
        score: 50,
        keywordOpportunities: ['Industry-specific keywords', 'Local search terms', 'Service-related keywords'],
        contentGaps: ['Blog content', 'Service pages', 'About page optimization'],
        recommendations: ['Create valuable content', 'Optimize existing pages', 'Add blog section']
      },
      localSEO: {
        score: 35,
        currentListings: 3,
        missedOpportunities: 30,
        recommendations: ['Submit to major directories', 'Optimize Google My Business', 'Increase local citations']
      },
      improvementAreas: ['Content optimization', 'Technical SEO', 'Local SEO', 'Directory presence'],
      priorityActions: ['Directory submissions', 'Content creation', 'Technical optimization'],
      estimatedImpact: {
        trafficIncrease: 150,
        rankingImprovement: 25,
        timeframe: '3-6 months'
      }
    }
  }

  private generateFallbackMarketInsights(websiteData: WebsiteData): MarketInsights {
    return {
      marketSize: 'Growing market with significant opportunity',
      growthRate: 8.5,
      marketTrends: ['Digital transformation', 'Remote work adoption', 'Online service demand'],
      customerBehavior: ['Online research before purchase', 'Mobile-first interactions', 'Review-driven decisions'],
      seasonalFactors: ['Q4 increased activity', 'Summer slowdown possible'],
      emergingOpportunities: ['AI integration', 'Mobile optimization', 'Voice search optimization'],
      marketChallenges: ['Increased competition', 'Customer acquisition costs', 'Market saturation'],
      recommendedTiming: ['Q1 launch optimal', 'Avoid holiday periods', 'Plan for seasonal trends']
    }
  }

  private generateFallbackRevenueProjections(websiteData: WebsiteData): RevenueProjection {
    return {
      timeframe: '6 months',
      conservative: {
        projectedRevenue: 25000,
        trafficIncrease: 120,
        leadIncrease: 85,
        conversionRate: 2.5,
        confidence: 75
      },
      optimistic: {
        projectedRevenue: 45000,
        trafficIncrease: 220,
        leadIncrease: 150,
        conversionRate: 3.8,
        confidence: 60
      },
      assumptions: ['Consistent marketing effort', 'Market conditions remain stable', 'Directory submissions successful'],
      keyFactors: ['Directory submission success', 'SEO improvements', 'Content marketing effectiveness']
    }
  }

  private generateFallbackIntelligence(websiteData: WebsiteData): AIInsights {
    return {
      businessProfile: this.generateFallbackBusinessProfile(websiteData),
      marketInsights: this.generateFallbackMarketInsights(websiteData),
      competitiveAnalysis: this.generateFallbackCompetitiveAnalysis(websiteData),
      seoAnalysis: this.generateFallbackSEOAnalysis(websiteData),
      revenueProjections: this.generateFallbackRevenueProjections(websiteData),
      actionableRecommendations: [
        'Submit to high-authority business directories',
        'Optimize website for local search',
        'Create valuable content for target audience',
        'Improve technical SEO performance',
        'Monitor and respond to online reviews'
      ],
      priorityScore: 75,
      confidenceLevel: 0.65
    }
  }

  // Helper methods
  private extractBusinessName(websiteData: WebsiteData): string {
    if (websiteData.title) {
      return websiteData.title.split(' - ')[0].split(' | ')[0]
    }
    
    const domain = new URL(websiteData.url).hostname
    return domain.replace('www.', '').split('.')[0]
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  private inferIndustry(websiteData: WebsiteData): string {
    const content = (websiteData.title + ' ' + websiteData.description + ' ' + websiteData.content).toLowerCase()
    
    const industries = {
      'Technology': ['software', 'tech', 'app', 'digital', 'ai', 'saas', 'platform'],
      'Healthcare': ['health', 'medical', 'doctor', 'clinic', 'wellness', 'therapy'],
      'Finance': ['finance', 'financial', 'accounting', 'investment', 'banking', 'insurance'],
      'Retail': ['retail', 'shop', 'store', 'ecommerce', 'fashion', 'clothing'],
      'Professional Services': ['consulting', 'legal', 'law', 'marketing', 'agency', 'services'],
      'Real Estate': ['real estate', 'property', 'homes', 'realtor', 'mortgage'],
      'Food & Beverage': ['restaurant', 'food', 'catering', 'cafe', 'bar', 'dining']
    }
    
    for (const [industry, keywords] of Object.entries(industries)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        return industry
      }
    }
    
    return 'Professional Services'
  }

  private generateActionableRecommendations(
    businessProfile: BusinessProfile,
    competitiveAnalysis: CompetitiveAnalysis,
    seoAnalysis: SEOAnalysis,
    marketInsights: MarketInsights
  ): string[] {
    const recommendations = []
    
    // SEO-based recommendations
    if (seoAnalysis.currentScore < 70) {
      recommendations.push('Improve overall SEO performance to increase organic visibility')
    }
    
    if (seoAnalysis.localSEO.currentListings < 10) {
      recommendations.push('Submit to high-authority business directories to improve local SEO')
    }
    
    // Competitive recommendations
    if (competitiveAnalysis.competitiveGaps.length > 0) {
      recommendations.push(`Address competitive gaps: ${competitiveAnalysis.competitiveGaps[0]}`)
    }
    
    // Market-based recommendations
    if (marketInsights.emergingOpportunities.length > 0) {
      recommendations.push(`Capitalize on emerging opportunity: ${marketInsights.emergingOpportunities[0]}`)
    }
    
    // Business-specific recommendations
    if (businessProfile.category === 'B2B') {
      recommendations.push('Focus on professional networking platforms and B2B directories')
    } else if (businessProfile.category === 'B2C') {
      recommendations.push('Prioritize consumer review platforms and local directories')
    }
    
    return recommendations.slice(0, 5) // Return top 5 recommendations
  }

  private calculatePriorityScore(
    businessProfile: BusinessProfile,
    competitiveAnalysis: CompetitiveAnalysis,
    seoAnalysis: SEOAnalysis
  ): number {
    let score = 50 // Base score
    
    // SEO factors
    if (seoAnalysis.currentScore < 60) score += 20
    if (seoAnalysis.localSEO.currentListings < 5) score += 15
    
    // Competitive factors
    if (competitiveAnalysis.competitiveGaps.length > 2) score += 10
    
    // Business factors
    if (businessProfile.category === 'B2B') score += 5
    
    return Math.min(100, Math.max(0, score))
  }
}

export default EnhancedAIBusinessAnalyzer
