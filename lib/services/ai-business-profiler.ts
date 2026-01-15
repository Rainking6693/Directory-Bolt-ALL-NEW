/**
 * AI-Powered Business Profiler
 * 
 * Uses Anthropic Claude or Gemini to generate comprehensive business profiles:
 * - Categorized business profiles
 * - Unique selling points
 * - Target audience segments
 * - Industry classification
 * - Business model analysis
 */

import { getAnthropicClient, callAI } from '../utils/anthropic-client'
import { logger } from '../utils/logger'
import type { ScrapedBusinessData } from './enhanced-website-scraper'

import type { BusinessProfile as AIBusinessProfile } from '../types/ai.types'

export type BusinessProfile = AIBusinessProfile

/**
 * AI Business Profiler Service
 */
export class AIBusinessProfiler {
  /**
   * Generate comprehensive business profile from scraped data
   */
  async generateBusinessProfile(scrapedData: ScrapedBusinessData): Promise<BusinessProfile> {
    try {
      logger.info('Generating AI business profile', { url: scrapedData.url })

      const prompt = this.buildProfilingPrompt(scrapedData)
      
      const aiResponse = await callAI(prompt, 'complex', {
        anthropicModel: 'claude-3-5-sonnet-20241022',
        maxTokens: 4000,
        temperature: 0.3,
        systemPrompt: this.getSystemPrompt()
      })

      const profile = this.parseAIResponse(aiResponse, scrapedData)

      logger.info('Business profile generated successfully', {
        businessName: profile.name,
        industry: profile.industry
      })

      return profile

    } catch (error) {
      logger.error('AI business profiling failed', { 
        url: scrapedData.url,
        error: error instanceof Error ? error.message : String(error)
      }, error as Error)

      // Fallback to basic profile from scraped data
      return this.createFallbackProfile(scrapedData)
    }
  }

  /**
   * Build the AI prompt for business profiling
   */
  private buildProfilingPrompt(scrapedData: ScrapedBusinessData): string {
    return `Analyze the following business website data and generate a comprehensive business profile.

URL: ${scrapedData.url}
Business Name: ${scrapedData.businessName}
Title: ${scrapedData.title}
Description: ${scrapedData.description}

Services/Products: ${scrapedData.services.join(', ') || 'Not specified'}
Key Services: ${scrapedData.keyServices.join(', ') || 'Not specified'}

About Text: ${scrapedData.aboutText?.substring(0, 1000) || 'Not available'}

Headings: ${scrapedData.h1.join('; ')}
Keywords: ${scrapedData.keywords.slice(0, 20).join(', ')}

Please provide a JSON response with the following structure:
{
  "name": "Business name",
  "industry": "Primary industry (e.g., Professional Services, E-commerce, Technology)",
  "category": "Specific category (e.g., Legal Services, SaaS Platform, Retail)",
  "description": "2-3 sentence business description",
  "targetAudience": ["Audience segment 1", "Audience segment 2", "Audience segment 3"],
  "businessModel": "Business model type (e.g., B2B Service Provider, B2C E-commerce, Marketplace)",
  "keyServices": ["Service 1", "Service 2", "Service 3"],
  "competitiveAdvantages": ["Advantage 1", "Advantage 2", "Advantage 3"],
  "marketPosition": "Market position (e.g., Established Provider, Emerging Player, Niche Specialist)",
  "uniqueSellingPoints": ["USP 1", "USP 2", "USP 3"],
  "valueProposition": "Clear value proposition statement"
}

Be specific and accurate based on the provided data.`
  }

  /**
   * System prompt for AI analysis
   */
  private getSystemPrompt(): string {
    return `You are an expert business intelligence analyst specializing in website analysis and business profiling. 
Your task is to analyze business websites and generate accurate, comprehensive profiles that help businesses understand their positioning and opportunities.

Key principles:
- Be specific and accurate based on the provided data
- Use industry-standard terminology
- Identify clear value propositions
- Provide actionable insights
- Return valid JSON only`
  }

  /**
   * Parse AI response into BusinessProfile object
   */
  private parseAIResponse(aiResponse: string, scrapedData: ScrapedBusinessData): BusinessProfile {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response')
      }

      const parsed = JSON.parse(jsonMatch[0])

      return {
        name: parsed.name || scrapedData.businessName,
        industry: parsed.industry || 'Professional Services',
        category: parsed.category || 'Business Services',
        description: parsed.description || scrapedData.description || '',
        targetAudience: Array.isArray(parsed.targetAudience) ? parsed.targetAudience : [],
        businessModel: parsed.businessModel || 'Service Provider',
        website: scrapedData.url,
        keyServices: Array.isArray(parsed.keyServices) ? parsed.keyServices : scrapedData.keyServices,
        competitiveAdvantages: Array.isArray(parsed.competitiveAdvantages) ? parsed.competitiveAdvantages : [],
        marketPosition: parsed.marketPosition || 'Established Provider',
        uniqueSellingPoints: Array.isArray(parsed.uniqueSellingPoints) ? parsed.uniqueSellingPoints : [],
        valueProposition: parsed.valueProposition || ''
      }

    } catch (error) {
      logger.error('Failed to parse AI response', { 
        error: error instanceof Error ? error.message : String(error)
      })
      return this.createFallbackProfile(scrapedData)
    }
  }

  /**
   * Create fallback profile when AI fails
   */
  private createFallbackProfile(scrapedData: ScrapedBusinessData): BusinessProfile {
      return {
        name: scrapedData.businessName,
        industry: 'Professional Services',
        category: 'Business Services',
        description: scrapedData.description || `Professional business services from ${scrapedData.businessName}`,
        targetAudience: ['Business Professionals', 'Local Customers'],
        businessModel: 'Service Provider',
        website: scrapedData.url,
        keyServices: scrapedData.keyServices.length > 0 ? scrapedData.keyServices : scrapedData.services.slice(0, 5),
        competitiveAdvantages: ['Quality Service', 'Customer Focus'],
        marketPosition: 'Established Provider',
        uniqueSellingPoints: [],
        valueProposition: `Professional services from ${scrapedData.businessName}`
      }
  }
}

// Export singleton instance
export const aiBusinessProfiler = new AIBusinessProfiler()
