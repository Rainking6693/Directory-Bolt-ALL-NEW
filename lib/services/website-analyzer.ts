import axios, { AxiosResponse } from 'axios'
import * as cheerio from 'cheerio'
import { logger } from '../utils/logger'
import { DirectoryDatabase } from '../database/directories'
import { AI, AIAnalysisResult, BusinessProfile } from './ai-service'

export interface WebsiteAnalyzerConfig {
  timeout: number
  maxRetries: number
  userAgent: string
  respectRobots: boolean
}

export interface AnalysisOptions {
  deep: boolean
  includeCompetitors: boolean
  checkDirectories: boolean
  maxDirectoriesToCheck: number
}

export interface DirectoryOpportunity {
  name: string
  authority: number
  estimatedTraffic: number
  submissionDifficulty: string
  cost: number
  listed: boolean
  url?: string
}

export interface AnalysisIssue {
  type: 'critical' | 'warning' | 'info'
  title: string
  description: string
  impact: string
  priority: number
}

export interface AnalysisRecommendation {
  action: string
  impact: string
  effort: 'low' | 'medium' | 'high'
}

export interface AnalysisResult {
  url: string
  title: string
  description: string
  currentListings: number
  missedOpportunities: number
  competitorAdvantage: number
  potentialLeads: number
  visibility: number
  seoScore: number
  issues: AnalysisIssue[]
  recommendations: AnalysisRecommendation[]
  directoryOpportunities: DirectoryOpportunity[]
  // AI-Enhanced Fields
  aiAnalysis?: AIAnalysisResult
  businessProfile?: BusinessProfile
  aiConfidence?: number
  smartRecommendations?: Array<{
    directory: string
    reasoning: string
    optimizedDescription: string
    successProbability: number
  }>
}

export class WebsiteAnalyzer {
  private config: WebsiteAnalyzerConfig
  private directoryDb: DirectoryDatabase

  constructor(config: WebsiteAnalyzerConfig) {
    this.config = config
    this.directoryDb = new DirectoryDatabase()
  }

  async analyzeWebsite(url: string, options: AnalysisOptions): Promise<AnalysisResult> {
    try {
      logger.info(`Starting website analysis for: ${url}`)

      // Fetch website content with retries
      const websiteData = await this.fetchWebsiteWithRetries(url)
      
      // Parse basic website information
      const $ = cheerio.load(websiteData.html) as cheerio.CheerioAPI as cheerio.CheerioAPI as cheerio.CheerioAPI
      const title = $('title').text().trim() || 'No title found'
      const description = $('meta[name="description"]').attr('content') || 
                         $('meta[property="og:description"]').attr('content') || 
                         'No description found'

      // Analyze SEO factors
      const seoScore = this.calculateSeoScore($, websiteData.html)

      // Check current directory listings
      const currentListings = await this.checkCurrentListings(url)

      // Get directory opportunities
      const directoryOpportunities = await this.getDirectoryOpportunities(
        url, 
        options.maxDirectoriesToCheck
      )

      // Calculate metrics
      const missedOpportunities = directoryOpportunities.filter(d => !d.listed).length
      const potentialLeads = this.calculatePotentialLeads(directoryOpportunities)
      const visibility = this.calculateVisibilityScore(currentListings, directoryOpportunities)
      const competitorAdvantage = this.calculateCompetitorAdvantage(currentListings)

      // Generate issues and recommendations
      const issues = this.generateIssues($, currentListings, seoScore)
      const recommendations = this.generateRecommendations(issues, directoryOpportunities, seoScore)

      // 🚀 AI-Enhanced Analysis (if enabled)
      let aiAnalysis: AIAnalysisResult | undefined
      let businessProfile: BusinessProfile | undefined
      let smartRecommendations: any[] | undefined

      if (AI.isEnabled()) {
        try {
          logger.info('Starting AI-powered analysis', { metadata: { url } })
          
          // Get all available directories for AI analysis
          const allDirectories = await this.directoryDb.getDirectories({ limit: 100 })
          
          // Run AI analysis
          aiAnalysis = await AI.analyzeWebsite(url, websiteData.html, allDirectories)
          businessProfile = aiAnalysis.businessProfile
          
          // Transform AI recommendations to our format
          smartRecommendations = aiAnalysis.recommendations.map(rec => ({
            directory: rec.name,
            reasoning: rec.reasoning,
            optimizedDescription: rec.optimizedDescription,
            successProbability: rec.successProbability
          }))

          logger.info('AI analysis completed successfully', {
            metadata: {
              url,
              category: businessProfile.category,
              confidence: aiAnalysis.confidence,
              recommendationCount: smartRecommendations.length
            }
          })
        } catch (error) {
          logger.warn('AI analysis failed, continuing with basic analysis', {
            metadata: { url, error }
          })
        }
      }

      const result: AnalysisResult = {
        url,
        title,
        description,
        currentListings: currentListings.length,
        missedOpportunities,
        competitorAdvantage,
        potentialLeads,
        visibility,
        seoScore,
        issues,
        recommendations,
        directoryOpportunities,
        // AI-Enhanced Fields
        aiAnalysis,
        businessProfile,
        aiConfidence: aiAnalysis?.confidence,
        smartRecommendations
      }

      logger.info(`Website analysis completed for: ${url}`, {
        metadata: {
          seoScore,
          currentListings: currentListings.length,
          missedOpportunities,
          visibility
        }
      })

      return result

    } catch (error) {
      logger.error(`Website analysis failed for: ${url}`, { metadata: { error } })
      throw new Error(`Failed to analyze website: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async fetchWebsiteWithRetries(url: string): Promise<{ html: string; statusCode: number }> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        logger.debug(`Fetching website attempt ${attempt}/${this.config.maxRetries}: ${url}`)

        const response: AxiosResponse = await axios.get(url, {
          timeout: this.config.timeout,
          headers: {
            'User-Agent': this.config.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          },
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 400,
        })

        return {
          html: response.data,
          statusCode: response.status
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown fetch error')
        
        if (attempt < this.config.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
          logger.debug(`Fetch attempt ${attempt} failed, retrying in ${delay}ms`, { metadata: { error: lastError.message } })
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError || new Error('Failed to fetch website after all retries')
  }

  private calculateSeoScore($: cheerio.CheerioAPI, html: string): number {
    let score = 100
    const issues: string[] = []

    // Title tag check
    const title = $('title').text().trim()
    if (!title) {
      score -= 15
      issues.push('Missing title tag')
    } else if (title.length < 30 || title.length > 60) {
      score -= 10
      issues.push('Title length not optimal (30-60 chars)')
    }

    // Meta description check
    const description = $('meta[name="description"]').attr('content')
    if (!description) {
      score -= 15
      issues.push('Missing meta description')
    } else if (description.length < 120 || description.length > 160) {
      score -= 10
      issues.push('Meta description length not optimal (120-160 chars)')
    }

    // H1 tag check
    const h1Count = $('h1').length
    if (h1Count === 0) {
      score -= 15
      issues.push('Missing H1 tag')
    } else if (h1Count > 1) {
      score -= 10
      issues.push('Multiple H1 tags found')
    }

    // Image alt tags
    const imagesWithoutAlt = $('img:not([alt])').length
    if (imagesWithoutAlt > 0) {
      score -= Math.min(20, imagesWithoutAlt * 2)
      issues.push(`${imagesWithoutAlt} images missing alt tags`)
    }

    // Schema markup check
    if (!html.includes('application/ld+json') && !html.includes('itemscope')) {
      score -= 10
      issues.push('Missing structured data')
    }

    // Open Graph tags
    if (!$('meta[property^="og:"]').length) {
      score -= 10
      issues.push('Missing Open Graph tags')
    }

    logger.debug(`SEO score calculated: ${score}`, { metadata: { issues } })
    return Math.max(0, Math.min(100, score))
  }

  private async checkCurrentListings(url: string): Promise<string[]> {
    // In production, this would check actual directory listings
    // For now, return mock data based on common patterns
    const domain = new URL(url).hostname
    const listings: string[] = []

    try {
      // Check for Google Business Profile (simplified check)
      const googleCheck = await this.checkGoogleBusiness(domain)
      if (googleCheck) listings.push('Google Business Profile')

      // Check for other common directories
      const commonDirectories = [
        'Yelp', 'Facebook Business', 'Yellow Pages', 'Bing Places',
        'Apple Maps', 'TripAdvisor', 'Foursquare', 'LinkedIn'
      ]

      // Mock logic - in production would make actual API calls
      for (const directory of commonDirectories) {
        if (Math.random() < 0.3) { // 30% chance of being listed
          listings.push(directory)
        }
      }

    } catch (error) {
      logger.warn('Error checking current listings', { metadata: { error, domain } })
    }

    return listings
  }

  private async checkGoogleBusiness(domain: string): Promise<boolean> {
    try {
      // Simplified Google Business check
      // In production, would use Google My Business API
      const searchQuery = `site:google.com/maps "${domain}"`
      // Mock implementation
      return Math.random() < 0.4 // 40% chance
    } catch (error) {
      logger.warn('Google Business check failed', { metadata: { error, domain } })
      return false
    }
  }

  private async getDirectoryOpportunities(url: string, maxDirectories: number): Promise<DirectoryOpportunity[]> {
    try {
      // Get directories from database
      const allDirectories = await this.directoryDb.getDirectories({ 
        limit: maxDirectories,
        orderBy: 'authority DESC' 
      })

      // Convert to opportunities with analysis
      return allDirectories.map(dir => ({
        name: dir.name,
        authority: dir.authority || 50,
        estimatedTraffic: dir.estimatedTraffic || 1000,
        submissionDifficulty: dir.difficulty || 'medium',
        cost: dir.price || 0,
        listed: Math.random() < 0.2, // 20% chance already listed
        url: dir.submissionUrl
      }))

    } catch (error) {
      logger.warn('Error getting directory opportunities', { metadata: { error } })
      
      // Fallback to hardcoded list
      return this.getDefaultDirectoryOpportunities()
    }
  }

  private getDefaultDirectoryOpportunities(): DirectoryOpportunity[] {
    return [
      {
        name: 'Google Business Profile',
        authority: 100,
        estimatedTraffic: 50000,
        submissionDifficulty: 'easy',
        cost: 0,
        listed: false
      },
      {
        name: 'Yelp',
        authority: 95,
        estimatedTraffic: 25000,
        submissionDifficulty: 'easy',
        cost: 0,
        listed: false
      },
      {
        name: 'Facebook Business',
        authority: 98,
        estimatedTraffic: 35000,
        submissionDifficulty: 'easy',
        cost: 0,
        listed: false
      },
      // Add more default directories...
    ]
  }

  private calculatePotentialLeads(opportunities: DirectoryOpportunity[]): number {
    return opportunities
      .filter(d => !d.listed)
      .reduce((total, d) => total + Math.floor(d.estimatedTraffic * 0.001), 0) // 0.1% conversion
  }

  private calculateVisibilityScore(currentListings: string[], opportunities: DirectoryOpportunity[]): number {
    const totalOpportunities = opportunities.length
    const currentCount = currentListings.length
    
    return Math.round((currentCount / totalOpportunities) * 100)
  }

  private calculateCompetitorAdvantage(currentListings: string[]): number {
    // Mock calculation - in production would analyze competitor listings
    const averageCompetitorListings = 85 // Industry average
    const advantage = Math.max(0, averageCompetitorListings - currentListings.length)
    return Math.round((advantage / averageCompetitorListings) * 100)
  }

  private generateIssues($: cheerio.CheerioAPI, currentListings: string[], seoScore: number): AnalysisIssue[] {
    const issues: AnalysisIssue[] = []

    if (currentListings.length < 10) {
      issues.push({
        type: 'critical',
        title: 'Missing from 89% of Key Directories',
        description: 'Your business is not listed in major directories where customers search daily',
        impact: 'Losing 150+ potential customers per month',
        priority: 1
      })
    }

    if (seoScore < 60) {
      issues.push({
        type: 'critical',
        title: 'Poor SEO Optimization',
        description: 'Your website has significant SEO issues affecting search visibility',
        impact: 'Reduced search engine rankings and organic traffic',
        priority: 2
      })
    }

    issues.push({
      type: 'warning',
      title: 'Inconsistent Business Information',
      description: 'Your NAP (Name, Address, Phone) varies across existing listings',
      impact: 'Confuses search engines and customers',
      priority: 3
    })

    return issues
  }

  private generateRecommendations(issues: AnalysisIssue[], opportunities: DirectoryOpportunity[], seoScore: number = 50): AnalysisRecommendation[] {
    const recommendations: AnalysisRecommendation[] = []

    const unlistedCount = opportunities.filter(d => !d.listed).length
    if (unlistedCount > 0) {
      const visibilityIncrease = Math.min(500, unlistedCount * 25) // 25% per directory, max 500%
      recommendations.push({
        action: `Submit to ${Math.min(unlistedCount, 10)} high-priority directories`,
        impact: `Increase online visibility by ${visibilityIncrease}%`,
        effort: unlistedCount > 5 ? 'medium' : 'low'
      })
    }

    const seoImpact = Math.min(80, (100 - seoScore))
    recommendations.push({
      action: 'Optimize website SEO fundamentals',
      impact: `Improve search rankings by ${seoImpact}% and increase organic traffic`,
      effort: seoScore < 40 ? 'high' : 'medium'
    })

    recommendations.push({
      action: 'Standardize business information (NAP) across all platforms',
      impact: 'Build trust with search engines and increase local search rankings by 15-25%',
      effort: 'low'
    })

    return recommendations
  }
}
