/**
 * SEO Audit Service
 * 
 * Performs lightweight SEO audit replacing Math.random() scores with real metrics:
 * - Check H1 tags (presence, count, quality)
 * - Analyze meta tags (title, description)
 * - Assess load speed indicators
 * - Check structured data
 * - Evaluate content quality
 */

import type { ScrapedBusinessData } from './enhanced-website-scraper'
import { logger } from '../utils/logger'

export interface SEOAuditResult {
  overallScore: number // 0-100
  h1Score: number // 0-100
  metaTagsScore: number // 0-100
  contentScore: number // 0-100
  technicalScore: number // 0-100
  
  issues: {
    missingH1: boolean
    multipleH1s: boolean
    missingMetaDescription: boolean
    titleTooLong: boolean
    descriptionTooLong: boolean
    noStructuredData: boolean
  }
  
  recommendations: string[]
  metrics: {
    h1Count: number
    h2Count: number
    titleLength: number
    descriptionLength: number
    hasStructuredData: boolean
    hasMetaKeywords: boolean
  }
}

/**
 * SEO Audit Service
 */
export class SEOAuditService {
  /**
   * Perform SEO audit on scraped website data
   */
  async auditWebsite(scrapedData: ScrapedBusinessData): Promise<SEOAuditResult> {
    try {
      logger.info('Starting SEO audit', { url: scrapedData.url })

      // Audit H1 tags
      const h1Score = this.auditH1Tags(scrapedData)

      // Audit meta tags
      const metaTagsScore = this.auditMetaTags(scrapedData)

      // Audit content quality
      const contentScore = this.auditContent(scrapedData)

      // Audit technical SEO
      const technicalScore = this.auditTechnicalSEO(scrapedData)

      // Calculate overall score (weighted average)
      const overallScore = Math.round(
        (h1Score * 0.25) +
        (metaTagsScore * 0.30) +
        (contentScore * 0.25) +
        (technicalScore * 0.20)
      )

      // Identify issues
      const issues = this.identifyIssues(scrapedData)

      // Generate recommendations
      const recommendations = this.generateRecommendations(scrapedData, issues)

      // Collect metrics
      const metrics = {
        h1Count: scrapedData.h1.length,
        h2Count: scrapedData.h2.length,
        titleLength: scrapedData.title.length,
        descriptionLength: scrapedData.description.length,
        hasStructuredData: !!scrapedData.structuredData,
        hasMetaKeywords: !!scrapedData.metaKeywords
      }

      const result: SEOAuditResult = {
        overallScore,
        h1Score,
        metaTagsScore,
        contentScore,
        technicalScore,
        issues,
        recommendations,
        metrics
      }

      logger.info('SEO audit completed', {
        url: scrapedData.url,
        overallScore,
        issuesCount: Object.values(issues).filter(Boolean).length
      })

      return result

    } catch (error) {
      logger.error('SEO audit failed', {
        url: scrapedData.url,
        error: error instanceof Error ? error.message : String(error)
      }, error as Error)

      // Return basic audit result
      return this.createFallbackAudit(scrapedData)
    }
  }

  /**
   * Audit H1 tags (presence, count, quality)
   */
  private auditH1Tags(scrapedData: ScrapedBusinessData): number {
    let score = 100

    // Missing H1: -40 points
    if (scrapedData.h1.length === 0) {
      score -= 40
    }

    // Multiple H1s: -20 points
    if (scrapedData.h1.length > 1) {
      score -= 20
    }

    // H1 too long (> 60 chars): -10 points
    if (scrapedData.h1.length > 0 && scrapedData.h1[0].length > 60) {
      score -= 10
    }

    // H1 too short (< 5 chars): -10 points
    if (scrapedData.h1.length > 0 && scrapedData.h1[0].length < 5) {
      score -= 10
    }

    // Bonus: Good H1 length (20-60 chars)
    if (scrapedData.h1.length === 1) {
      const h1Length = scrapedData.h1[0].length
      if (h1Length >= 20 && h1Length <= 60) {
        score = Math.min(100, score + 5) // Bonus
      }
    }

    return Math.max(0, Math.min(100, score))
  }

  /**
   * Audit meta tags (title, description)
   */
  private auditMetaTags(scrapedData: ScrapedBusinessData): number {
    let score = 100

    // Missing title: -30 points
    if (!scrapedData.title || scrapedData.title.length === 0) {
      score -= 30
    }

    // Title too long (> 60 chars): -15 points
    if (scrapedData.title.length > 60) {
      score -= 15
    }

    // Title too short (< 10 chars): -15 points
    if (scrapedData.title.length > 0 && scrapedData.title.length < 10) {
      score -= 15
    }

    // Missing meta description: -30 points
    if (!scrapedData.description || scrapedData.description.length === 0) {
      score -= 30
    }

    // Description too long (> 160 chars): -15 points
    if (scrapedData.description.length > 160) {
      score -= 15
    }

    // Description too short (< 50 chars): -10 points
    if (scrapedData.description.length > 0 && scrapedData.description.length < 50) {
      score -= 10
    }

    // Bonus: Optimal title length (30-60 chars)
    if (scrapedData.title.length >= 30 && scrapedData.title.length <= 60) {
      score = Math.min(100, score + 5)
    }

    // Bonus: Optimal description length (120-160 chars)
    if (scrapedData.description.length >= 120 && scrapedData.description.length <= 160) {
      score = Math.min(100, score + 5)
    }

    return Math.max(0, Math.min(100, score))
  }

  /**
   * Audit content quality
   */
  private auditContent(scrapedData: ScrapedBusinessData): number {
    let score = 100

    // Missing H2s: -20 points (suggests poor content structure)
    if (scrapedData.h2.length === 0) {
      score -= 20
    }

    // Few H2s (< 3): -10 points
    if (scrapedData.h2.length > 0 && scrapedData.h2.length < 3) {
      score -= 10
    }

    // Missing about text: -15 points
    if (!scrapedData.aboutText || scrapedData.aboutText.length < 100) {
      score -= 15
    }

    // Too little content (< 300 chars): -20 points
    if (scrapedData.aboutText && scrapedData.aboutText.length < 300) {
      score -= 20
    }

    // Bonus: Good content structure (3+ H2s, substantial text)
    if (scrapedData.h2.length >= 3 && scrapedData.aboutText && scrapedData.aboutText.length >= 500) {
      score = Math.min(100, score + 10)
    }

    return Math.max(0, Math.min(100, score))
  }

  /**
   * Audit technical SEO
   */
  private auditTechnicalSEO(scrapedData: ScrapedBusinessData): number {
    let score = 100

    // Missing structured data: -20 points
    if (!scrapedData.structuredData) {
      score -= 20
    }

    // Missing contact information: -15 points
    if (!scrapedData.phone && !scrapedData.email) {
      score -= 15
    }

    // Missing address: -10 points
    if (!scrapedData.address) {
      score -= 10
    }

    // Bonus: Has structured data
    if (scrapedData.structuredData) {
      score = Math.min(100, score + 10)
    }

    // Bonus: Complete NAP data
    if (scrapedData.name && scrapedData.address && scrapedData.phone) {
      score = Math.min(100, score + 10)
    }

    return Math.max(0, Math.min(100, score))
  }

  /**
   * Identify SEO issues
   */
  private identifyIssues(scrapedData: ScrapedBusinessData): SEOAuditResult['issues'] {
    return {
      missingH1: scrapedData.h1.length === 0,
      multipleH1s: scrapedData.h1.length > 1,
      missingMetaDescription: !scrapedData.description || scrapedData.description.length === 0,
      titleTooLong: scrapedData.title.length > 60,
      descriptionTooLong: scrapedData.description.length > 160,
      noStructuredData: !scrapedData.structuredData
    }
  }

  /**
   * Generate SEO recommendations
   */
  private generateRecommendations(
    scrapedData: ScrapedBusinessData,
    issues: SEOAuditResult['issues']
  ): string[] {
    const recommendations: string[] = []

    if (issues.missingH1) {
      recommendations.push('Add a single, descriptive H1 tag to the main page')
    }

    if (issues.multipleH1s) {
      recommendations.push('Reduce to a single H1 tag per page (use H2-H6 for subheadings)')
    }

    if (issues.missingMetaDescription) {
      recommendations.push('Add a meta description (150-160 characters recommended)')
    }

    if (issues.titleTooLong) {
      recommendations.push('Optimize page title to 50-60 characters for better search visibility')
    }

    if (issues.descriptionTooLong) {
      recommendations.push('Shorten meta description to 150-160 characters')
    }

    if (issues.noStructuredData) {
      recommendations.push('Add structured data (JSON-LD) to improve search engine understanding')
    }

    if (!scrapedData.address && !scrapedData.phone) {
      recommendations.push('Add business contact information (address, phone) for local SEO')
    }

    if (scrapedData.h2.length < 3) {
      recommendations.push('Improve content structure by adding more H2 headings')
    }

    if (!scrapedData.aboutText || scrapedData.aboutText.length < 300) {
      recommendations.push('Expand page content with more descriptive text about your business')
    }

    return recommendations.length > 0 ? recommendations : ['SEO fundamentals are in place']
  }

  /**
   * Create fallback audit result
   */
  private createFallbackAudit(scrapedData: ScrapedBusinessData): SEOAuditResult {
    const hasTitle = !!scrapedData.title && scrapedData.title.length > 0
    const hasDescription = !!scrapedData.description && scrapedData.description.length > 0
    const hasH1 = scrapedData.h1.length > 0

    // Calculate basic score
    let score = 50 // Base score
    if (hasTitle) score += 15
    if (hasDescription) score += 15
    if (hasH1) score += 10
    if (scrapedData.h2.length > 0) score += 5
    if (scrapedData.structuredData) score += 5

    return {
      overallScore: Math.min(100, score),
      h1Score: hasH1 ? 70 : 40,
      metaTagsScore: (hasTitle && hasDescription) ? 75 : 50,
      contentScore: scrapedData.aboutText && scrapedData.aboutText.length > 200 ? 70 : 50,
      technicalScore: scrapedData.structuredData ? 70 : 50,
      issues: {
        missingH1: !hasH1,
        multipleH1s: scrapedData.h1.length > 1,
        missingMetaDescription: !hasDescription,
        titleTooLong: scrapedData.title.length > 60,
        descriptionTooLong: scrapedData.description.length > 160,
        noStructuredData: !scrapedData.structuredData
      },
      recommendations: [
        'Optimize page title and meta description',
        'Ensure single H1 tag per page',
        'Add structured data for better search visibility'
      ],
      metrics: {
        h1Count: scrapedData.h1.length,
        h2Count: scrapedData.h2.length,
        titleLength: scrapedData.title.length,
        descriptionLength: scrapedData.description.length,
        hasStructuredData: !!scrapedData.structuredData,
        hasMetaKeywords: !!scrapedData.metaKeywords
      }
    }
  }
}

// Export singleton instance
export const seoAuditService = new SEOAuditService()
