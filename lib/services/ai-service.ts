// 🚀 JORDAN'S AI SERVICE - OpenAI Integration for Smart Business Analysis
// Revolutionary AI-powered directory recommendations and business optimization

import OpenAI from 'openai'
import { logger } from '../utils/logger'

export interface BusinessProfile {
  name: string
  description: string
  category: string
  subcategory?: string
  industry: string
  location?: {
    city?: string
    country?: string
    region?: string
  }
  targetAudience: string[]
  keywords: string[]
  businessModel: string
  size: 'startup' | 'small' | 'medium' | 'enterprise'
  stage: 'idea' | 'early' | 'growth' | 'mature'
}

export interface DirectoryMatch {
  directoryId: string
  name: string
  relevanceScore: number // 0-100
  successProbability: number // 0-100
  estimatedTraffic: number
  priority: 'high' | 'medium' | 'low'
  reasoning: string
  optimizedDescription: string
  tags: string[]
  submissionTips: string[]
}

export interface AIAnalysisResult {
  businessProfile: BusinessProfile
  recommendations: DirectoryMatch[]
  insights: {
    marketPosition: string
    competitiveAdvantages: string[]
    improvementSuggestions: string[]
    successFactors: string[]
  }
  confidence: number // 0-100
}

export interface CompetitorAnalysis {
  competitors: Array<{
    name: string
    similarities: string[]
    directoryPresence: string[]
    marketAdvantages: string[]
  }>
  marketGaps: string[]
  positioningAdvice: string
}

export class AIService {
  private openai: OpenAI
  private readonly model = 'gpt-4o-mini'
  
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is required')
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
    
    logger.info('AI Service initialized with GPT-4o-mini')
  }

  async analyzeBusinessWebsite(
    url: string, 
    websiteContent: string,
    directories: any[]
  ): Promise<AIAnalysisResult> {
    try {
      logger.info(`Starting AI analysis for ${url}`, {
        metadata: { contentLength: websiteContent.length, directoryCount: directories.length }
      })

      // Extract business profile using AI
      const businessProfile = await this.extractBusinessProfile(url, websiteContent)
      
      // Generate smart directory recommendations
      const recommendations = await this.generateDirectoryRecommendations(
        businessProfile, 
        directories
      )
      
      // Generate business insights
      const insights = await this.generateBusinessInsights(businessProfile, websiteContent)
      
      const result: AIAnalysisResult = {
        businessProfile,
        recommendations: recommendations.slice(0, 10), // Top 10 recommendations
        insights,
        confidence: this.calculateConfidence(businessProfile, websiteContent)
      }

      logger.info(`AI analysis completed for ${url}`, {
        metadata: {
          category: businessProfile.category,
          recommendationCount: result.recommendations?.length || 0,
          confidence: result.confidence || 0
        }
      })

      return result

    } catch (error) {
      logger.error('AI analysis failed', { metadata: { url, error } })
      throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async extractBusinessProfile(url: string, content: string): Promise<BusinessProfile> {
    const prompt = `Analyze this business website and extract a comprehensive business profile.

Website URL: ${url}
Website Content: ${content.substring(0, 8000)}

Provide a JSON response with the following structure:
{
  "name": "Business name",
  "description": "2-3 sentence description of what the business does",
  "category": "Primary business category (e.g., SaaS, E-commerce, Consulting, etc.)",
  "subcategory": "More specific subcategory if applicable",
  "industry": "Industry vertical (e.g., Finance, Healthcare, Marketing, etc.)",
  "location": {
    "city": "City if mentioned",
    "country": "Country if mentioned",
    "region": "Region if mentioned"
  },
  "targetAudience": ["Primary target audiences"],
  "keywords": ["Relevant SEO keywords and industry terms"],
  "businessModel": "How they make money (B2B SaaS, B2C E-commerce, Services, etc.)",
  "size": "startup|small|medium|enterprise",
  "stage": "idea|early|growth|mature"
}

Be accurate and specific. Focus on extracting factual information from the website content.`

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1000,
    })

    try {
      return JSON.parse(response.choices[0].message.content || '{}')
    } catch (error) {
      logger.warn('Failed to parse business profile JSON', { metadata: { error } })
      // Return a fallback profile
      return {
        name: 'Unknown Business',
        description: 'Business analysis in progress',
        category: 'General',
        industry: 'Various',
        targetAudience: [],
        keywords: [],
        businessModel: 'Unknown',
        size: 'small',
        stage: 'early'
      }
    }
  }

  private async generateDirectoryRecommendations(
    profile: BusinessProfile, 
    directories: any[]
  ): Promise<DirectoryMatch[]> {
    const directoryList = directories.map(d => ({
      id: d.id,
      name: d.name,
      category: d.category,
      authority: d.authority,
      estimatedTraffic: d.estimatedTraffic || d.estimated_traffic,
      features: d.features || [],
      submissionUrl: d.submissionUrl || d.submission_url
    }))

    const prompt = `As an expert directory submission strategist, recommend the best directories for this business profile.

Business Profile:
- Name: ${profile.name}
- Description: ${profile.description}
- Category: ${profile.category}
- Industry: ${profile.industry}
- Target Audience: ${profile.targetAudience.join(', ')}
- Keywords: ${profile.keywords.join(', ')}
- Business Model: ${profile.businessModel}
- Size: ${profile.size}
- Stage: ${profile.stage}

Available Directories:
${JSON.stringify(directoryList, null, 2)}

For each recommended directory, provide:
1. Relevance score (0-100) based on business fit
2. Success probability (0-100) based on directory criteria and business profile
3. Priority level (high/medium/low)
4. Detailed reasoning for the recommendation
5. Optimized description for this specific directory
6. Relevant tags for categorization
7. Specific submission tips

Return a JSON array of recommendations, sorted by overall value (relevance × success probability × traffic potential).

Focus on directories that:
- Match the business category and industry
- Align with target audience
- Have high authority and traffic
- Offer the best ROI potential

Provide actionable, specific recommendations that justify the premium pricing.`

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 2000,
    })

    try {
      const recommendations = JSON.parse(response.choices[0].message.content || '[]')
      
      return recommendations.map((rec: any) => ({
        directoryId: rec.directoryId || rec.id,
        name: rec.name,
        relevanceScore: Math.min(100, Math.max(0, rec.relevanceScore || 50)),
        successProbability: Math.min(100, Math.max(0, rec.successProbability || 50)),
        estimatedTraffic: rec.estimatedTraffic || 1000,
        priority: rec.priority || 'medium',
        reasoning: rec.reasoning || 'AI recommended based on business profile',
        optimizedDescription: rec.optimizedDescription || profile.description,
        tags: rec.tags || [],
        submissionTips: rec.submissionTips || []
      }))
    } catch (error) {
      logger.warn('Failed to parse directory recommendations', { metadata: { error } })
      return []
    }
  }

  private async generateBusinessInsights(
    profile: BusinessProfile, 
    content: string
  ): Promise<AIAnalysisResult['insights']> {
    const prompt = `Analyze this business and provide strategic insights for directory submissions and online presence.

Business Profile:
${JSON.stringify(profile, null, 2)}

Website Content Sample:
${content.substring(0, 4000)}

Provide insights in JSON format:
{
  "marketPosition": "Assessment of current market position and competitive landscape",
  "competitiveAdvantages": ["Key differentiators and strengths"],
  "improvementSuggestions": ["Actionable suggestions for better directory success"],
  "successFactors": ["Key factors that will drive directory submission success"]
}

Focus on:
- Market positioning and differentiation
- Competitive advantages for directory submissions
- Areas for improvement in online presence
- Success factors for directory approval and traffic generation`

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 800,
    })

    try {
      return JSON.parse(response.choices[0].message.content || '{}')
    } catch (error) {
      return {
        marketPosition: 'Analysis in progress',
        competitiveAdvantages: [],
        improvementSuggestions: [],
        successFactors: []
      }
    }
  }

  // Premium AI Features for Pro Tier
  async generateMultipleDescriptions(
    profile: BusinessProfile,
    directory: any,
    count: number = 5
  ): Promise<string[]> {
    const prompt = `Create ${count} different optimized descriptions for this business to submit to the directory.

Business: ${profile.name}
Description: ${profile.description}
Category: ${profile.category}
Target Audience: ${profile.targetAudience.join(', ')}

Directory: ${directory.name}
Directory Category: ${directory.category}
Directory Features: ${directory.features?.join(', ') || 'General directory'}

Create ${count} variations that:
1. Highlight different business strengths
2. Use varied keywords and phrases
3. Appeal to different audience segments
4. Match the directory's style and requirements
5. Are compelling and professional

Return as JSON array of strings. Each description should be 150-200 characters.`

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 600,
    })

    try {
      return JSON.parse(response.choices[0].message.content || '[]')
    } catch (error) {
      return [profile.description]
    }
  }

  async analyzeCompetitors(profile: BusinessProfile): Promise<CompetitorAnalysis> {
    const prompt = `Analyze the competitive landscape for this business and provide strategic insights.

Business Profile:
- Name: ${profile.name}
- Description: ${profile.description}
- Category: ${profile.category}
- Industry: ${profile.industry}
- Keywords: ${profile.keywords.join(', ')}

Provide competitor analysis in JSON format:
{
  "competitors": [
    {
      "name": "Competitor name",
      "similarities": ["What makes them similar"],
      "directoryPresence": ["Likely directories they're listed in"],
      "marketAdvantages": ["Their competitive advantages"]
    }
  ],
  "marketGaps": ["Opportunities in the market"],
  "positioningAdvice": "Strategic advice for positioning against competitors"
}

Focus on:
- Direct and indirect competitors
- Their likely directory presence
- Market gaps and opportunities
- Strategic positioning advice`

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 1000,
    })

    try {
      return JSON.parse(response.choices[0].message.content || '{}')
    } catch (error) {
      return {
        competitors: [],
        marketGaps: [],
        positioningAdvice: 'Competitive analysis in progress'
      }
    }
  }

  private calculateConfidence(profile: BusinessProfile, content: string): number {
    let confidence = 50 // Base confidence

    // Increase confidence based on profile completeness
    if (profile.name && profile.name !== 'Unknown Business') confidence += 15
    if (profile.description && profile.description.length > 50) confidence += 10
    if (profile.category && profile.category !== 'General') confidence += 10
    if (profile.keywords.length > 3) confidence += 10
    if (profile.targetAudience.length > 0) confidence += 10

    // Increase confidence based on content quality
    if (content.length > 2000) confidence += 5
    if (content.includes('about') || content.includes('services')) confidence += 5

    return Math.min(100, confidence)
  }

  // Utility method to check if AI features are available
  static isAIEnabled(): boolean {
    return !!process.env.OPENAI_API_KEY
  }

  // Rate limiting and cost management
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      })
      
      return !!response.choices[0]?.message?.content
    } catch (error) {
      logger.error('AI service health check failed', { metadata: { error } })
      return false
    }
  }
}

// Lazy singleton instance
let aiServiceInstance: AIService | null = null

function getAIService(): AIService {
  if (!aiServiceInstance) {
    if (!AIService.isAIEnabled()) {
      throw new Error('AI service is not enabled - OpenAI API key is required')
    }
    aiServiceInstance = new AIService()
  }
  return aiServiceInstance
}

// Convenience functions for easy integration
export const AI = {
  analyzeWebsite: (url: string, content: string, directories: any[]) => {
    if (!AIService.isAIEnabled()) {
      throw new Error('AI service is not enabled')
    }
    return getAIService().analyzeBusinessWebsite(url, content, directories)
  },
  
  generateDescriptions: (profile: BusinessProfile, directory: any, count?: number) => {
    if (!AIService.isAIEnabled()) {
      throw new Error('AI service is not enabled')
    }
    return getAIService().generateMultipleDescriptions(profile, directory, count)
  },
  
  analyzeCompetitors: (profile: BusinessProfile) => {
    if (!AIService.isAIEnabled()) {
      throw new Error('AI service is not enabled')
    }
    return getAIService().analyzeCompetitors(profile)
  },
  
  isEnabled: () => AIService.isAIEnabled(),
  
  healthCheck: () => {
    if (!AIService.isAIEnabled()) {
      return Promise.resolve(false)
    }
    return getAIService().healthCheck()
  }
}
