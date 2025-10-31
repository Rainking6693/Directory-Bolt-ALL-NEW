// 🚀 ENHANCED WEBSITE ANALYZER - AI-Powered Business Intelligence
// Comprehensive website analysis with visual capture and deep business insights

import axios from 'axios'
import * as cheerio from 'cheerio'
import { logger } from '../utils/logger'

// Dynamic imports for server-side only modules
let puppeteer: any = null;
let chromium: any = null;
let Browser: any = null;
let Page: any = null;

// Only import puppeteer on server-side
if (typeof window === 'undefined') {
  try {
    puppeteer = require('puppeteer-core');
    chromium = require('@sparticuz/chromium');
    // Import types from puppeteer-core for server-side use
    ({ Browser, Page } = require('puppeteer-core'));
  } catch (error) {
    console.warn('Puppeteer modules not available:', error);
  }
}
import { BusinessIntelligence, EnhancedBusinessProfile, SEOAnalysis, ContentAnalysis, SocialMediaPresence, TechnologyStack } from '../types/business-intelligence'

export interface EnhancedAnalysisConfig {
  timeout: number
  maxRetries: number
  userAgent: string
  enableScreenshots: boolean
  enableSocialAnalysis: boolean
  enableTechStackAnalysis: boolean
  screenshotOptions: ScreenshotOptions
}

export interface ScreenshotOptions {
  fullPage: boolean
  width: number
  height: number
  quality: number
  format: 'png' | 'jpeg' | 'webp'
}

export interface ExtractedData {
  basicInfo: BasicWebsiteInfo
  businessProfile: Partial<EnhancedBusinessProfile>
  seoAnalysis: SEOAnalysis
  contentAnalysis: ContentAnalysis
  socialPresence: SocialMediaPresence
  techStack: TechnologyStack
  screenshots: Screenshot[]
  structuredData: StructuredDataAnalysis
  performanceMetrics: PerformanceMetrics
}

export interface BasicWebsiteInfo {
  title: string
  description: string
  keywords: string[]
  language: string
  charset: string
  viewport: string
  favicon: string
  canonicalUrl: string
}

export interface Screenshot {
  type: 'full' | 'above-fold' | 'mobile'
  url: string
  base64?: string
  dimensions: { width: number; height: number }
  timestamp: Date
}

export interface StructuredDataAnalysis {
  hasStructuredData: boolean
  schemaTypes: string[]
  jsonLdCount: number
  microdataCount: number
  organizationData: OrganizationData
  productData: ProductData[]
  breadcrumbs: BreadcrumbData[]
}

export interface OrganizationData {
  name?: string
  description?: string
  url?: string
  logo?: string
  contactPoint?: ContactPointData
  address?: AddressData
  sameAs?: string[]
}

export interface ProductData {
  name: string
  description: string
  price?: string
  currency?: string
  availability?: string
  brand?: string
  sku?: string
}

export interface ContactPointData {
  telephone?: string
  email?: string
  contactType?: string
  areaServed?: string[]
}

export interface AddressData {
  streetAddress?: string
  addressLocality?: string
  addressRegion?: string
  postalCode?: string
  addressCountry?: string
}

export interface BreadcrumbData {
  position: number
  name: string
  item: string
}

export interface PerformanceMetrics {
  loadTime: number
  firstContentfulPaint: number
  largestContentfulPaint: number
  cumulativeLayoutShift: number
  firstInputDelay: number
  totalBlockingTime: number
  speedIndex: number
  performanceScore: number
}

export interface SocialMediaLink {
  platform: string
  url: string
  verified?: boolean
  followers?: number
}

export interface TechAnalysisResult {
  cms?: string
  framework?: string
  analytics: string[]
  advertising: string[]
  ecommerce: string[]
  hosting: string[]
  cdn: string[]
  security: string[]
  performance: string[]
  marketing: string[]
}

export class EnhancedWebsiteAnalyzer {
  private config: EnhancedAnalysisConfig
  private browser: any = null

  constructor(config: EnhancedAnalysisConfig) {
    this.config = config
  }

  async analyzeWebsite(url: string): Promise<ExtractedData> {
    try {
      logger.info(`Starting enhanced website analysis for: ${url}`)

      // Initialize browser for screenshots if enabled
      if (this.config.enableScreenshots) {
        try {
          // Configure for serverless environment
          const isServerless = process.env.NETLIFY || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
          
          if (isServerless) {
            // Use @sparticuz/chromium for serverless
            this.browser = await puppeteer.launch({
              args: chromium.args,
              defaultViewport: chromium.defaultViewport,
              executablePath: await chromium.executablePath(),
              headless: chromium.headless,
              ignoreHTTPSErrors: true,
            })
          } else {
            // Use local Chrome for development with environment path
            const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || 
                                   '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' || // macOS
                                   'google-chrome' // Linux
            
            this.browser = await puppeteer.launch({
              headless: 'new',
              executablePath: executablePath,
              args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
              ]
            })
          }
        } catch (browserError) {
          logger.warn('Failed to launch browser, continuing without screenshots', { metadata: { error: browserError } })
          this.browser = null
          // Disable screenshots for this analysis
          this.config.enableScreenshots = false
        }
      }

      // Parallel execution of analysis tasks
      const [
        htmlData,
        screenshots,
        performanceMetrics
      ] = await Promise.all([
        this.fetchWebsiteData(url),
        this.config.enableScreenshots ? this.captureScreenshots(url) : Promise.resolve([]),
        this.config.enableScreenshots ? this.analyzePerformance(url) : Promise.resolve(this.getDefaultPerformanceMetrics())
      ])

      // Parse HTML content
      const $ = cheerio.load(htmlData.html) as cheerio.CheerioAPI as cheerio.CheerioAPI as cheerio.CheerioAPI

      // Extract comprehensive data
      const basicInfo = this.extractBasicInfo($, url)
      const businessProfile = await this.extractBusinessProfile($, htmlData.html, url)
      const seoAnalysis = this.analyzeSEO($, htmlData.html)
      const contentAnalysis = this.analyzeContent($, htmlData.html)
      const socialPresence = this.analyzeSocialPresence($)
      const techStack = await this.analyzeTechStack($, htmlData.html, url)
      const structuredData = this.analyzeStructuredData($)

      const result: ExtractedData = {
        basicInfo,
        businessProfile,
        seoAnalysis,
        contentAnalysis,
        socialPresence,
        techStack,
        screenshots,
        structuredData,
        performanceMetrics
      }

      logger.info(`Enhanced website analysis completed for: ${url}`, {
        metadata: {
          screenshotsCount: screenshots.length,
          techStackItems: Object.keys(techStack).length,
          seoScore: seoAnalysis.currentScore,
          performanceScore: performanceMetrics.performanceScore
        }
      })

      return result

    } catch (error) {
      logger.error(`Enhanced website analysis failed for: ${url}`, { metadata: { error } })
      throw new Error(`Enhanced analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      if (this.browser) {
        await this.browser.close()
        this.browser = null
      }
    }
  }

  private async fetchWebsiteData(url: string): Promise<{ html: string; statusCode: number; headers: any }> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await axios.get(url, {
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
          statusCode: response.status,
          headers: response.headers
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown fetch error')
        
        if (attempt < this.config.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError || new Error('Failed to fetch website after all retries')
  }

  private async captureScreenshots(url: string): Promise<Screenshot[]> {
    if (!this.browser) return []

    try {
      const screenshots: Screenshot[] = []
      const page = await this.browser.newPage()

      // Desktop screenshot
      await page.setViewport({ width: this.config.screenshotOptions.width, height: this.config.screenshotOptions.height })
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

      const desktopScreenshot = await page.screenshot({
        fullPage: this.config.screenshotOptions.fullPage,
        quality: this.config.screenshotOptions.quality,
        type: this.config.screenshotOptions.format,
        encoding: 'base64'
      })

      screenshots.push({
        type: 'full',
        url: url,
        base64: desktopScreenshot as string,
        dimensions: { width: this.config.screenshotOptions.width, height: this.config.screenshotOptions.height },
        timestamp: new Date()
      })

      // Mobile screenshot
      await page.setViewport({ width: 390, height: 844 }) // iPhone 12 Pro dimensions
      await page.reload({ waitUntil: 'networkidle2' })

      const mobileScreenshot = await page.screenshot({
        fullPage: this.config.screenshotOptions.fullPage,
        quality: this.config.screenshotOptions.quality,
        type: this.config.screenshotOptions.format,
        encoding: 'base64'
      })

      screenshots.push({
        type: 'mobile',
        url: url,
        base64: mobileScreenshot as string,
        dimensions: { width: 390, height: 844 },
        timestamp: new Date()
      })

      await page.close()
      return screenshots

    } catch (error) {
      logger.warn('Screenshot capture failed', { metadata: { error } })
      return []
    }
  }

  private async analyzePerformance(url: string): Promise<PerformanceMetrics> {
    if (!this.browser) return this.getDefaultPerformanceMetrics()

    try {
      const page = await this.browser.newPage()
      await page.goto(url, { waitUntil: 'networkidle2' })

      // Get performance metrics
      const performanceData = await page.evaluate(() => {
        const perfEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        return {
          loadTime: perfEntry.loadEventEnd - perfEntry.fetchStart,
          domContentLoaded: perfEntry.domContentLoadedEventEnd - perfEntry.fetchStart,
          firstByte: perfEntry.responseStart - perfEntry.fetchStart,
          transferSize: perfEntry.transferSize || 0
        }
      })

      // Calculate performance score (simplified)
      const performanceScore = this.calculatePerformanceScore(performanceData.loadTime)

      await page.close()

      return {
        loadTime: performanceData.loadTime,
        firstContentfulPaint: 0, // Would need more complex implementation
        largestContentfulPaint: 0,
        cumulativeLayoutShift: 0,
        firstInputDelay: 0,
        totalBlockingTime: 0,
        speedIndex: 0,
        performanceScore
      }

    } catch (error) {
      logger.warn('Performance analysis failed', { metadata: { error } })
      return this.getDefaultPerformanceMetrics()
    }
  }

  private calculatePerformanceScore(loadTime: number): number {
    if (loadTime < 1500) return 100
    if (loadTime < 2500) return 90
    if (loadTime < 4000) return 75
    if (loadTime < 6000) return 50
    return 25
  }

  private getDefaultPerformanceMetrics(): PerformanceMetrics {
    return {
      loadTime: 0,
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
      cumulativeLayoutShift: 0,
      firstInputDelay: 0,
      totalBlockingTime: 0,
      speedIndex: 0,
      performanceScore: 50
    }
  }

  private extractBasicInfo($: cheerio.CheerioAPI, url: string): BasicWebsiteInfo {
    return {
      title: $('title').text().trim() || '',
      description: $('meta[name="description"]').attr('content') || 
                   $('meta[property="og:description"]').attr('content') || '',
      keywords: ($('meta[name="keywords"]').attr('content') || '').split(',').map(k => k.trim()).filter(Boolean),
      language: $('html').attr('lang') || 'en',
      charset: $('meta[charset]').attr('charset') || 'UTF-8',
      viewport: $('meta[name="viewport"]').attr('content') || '',
      favicon: this.findFavicon($),
      canonicalUrl: $('link[rel="canonical"]').attr('href') || url
    }
  }

  private findFavicon($: cheerio.CheerioAPI): string {
    const faviconSelectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
      'link[rel="apple-touch-icon-precomposed"]'
    ]

    for (const selector of faviconSelectors) {
      const href = $(selector).attr('href')
      if (href) return href
    }

    return '/favicon.ico'
  }

  private async extractBusinessProfile($: cheerio.CheerioAPI, html: string, url: string): Promise<Partial<EnhancedBusinessProfile>> {
    const domain = new URL(url).hostname

    // Extract business name
    const businessName = this.extractBusinessName($, html)
    
    // Extract description/tagline
    const description = this.extractBusinessDescription($, html)
    
    // Extract contact information
    const contactInfo = this.extractContactInfo($, html)
    
    // Extract location information
    const location = this.extractLocationInfo($, html)

    return {
      name: businessName,
      domain: domain,
      description: description,
      contactInfo: contactInfo,
      location: location
    }
  }

  private extractBusinessName($: cheerio.CheerioAPI, html: string): string {
    // Try multiple methods to extract business name
    const candidates = [
      $('meta[property="og:site_name"]').attr('content'),
      $('meta[name="application-name"]').attr('content'),
      $('.logo').text().trim(),
      $('[class*="logo"]').first().text().trim(),
      $('h1').first().text().trim(),
      $('title').text().split('|')[0].split('-')[0].trim()
    ].filter(Boolean)

    return candidates[0] || 'Unknown Business'
  }

  private extractBusinessDescription($: cheerio.CheerioAPI, html: string): string {
    const candidates = [
      $('meta[name="description"]').attr('content'),
      $('meta[property="og:description"]').attr('content'),
      $('.hero-description, .hero-subtitle, .tagline').text().trim(),
      $('p').first().text().trim()
    ].filter(Boolean)

    return candidates[0] || ''
  }

  private extractContactInfo($: cheerio.CheerioAPI, html: string): any {
    // Extract email
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi
    const emails = html.match(emailRegex) || []

    // Extract phone numbers
    const phoneRegex = /(\+?1?[-.\s]?)?(\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/g
    const phones = html.match(phoneRegex) || []

    // Extract social links
    const socialLinks = this.extractSocialLinks($)

    // Extract website hostname safely
    let websiteHostname = undefined
    try {
      const canonicalUrl = $('link[rel="canonical"]').attr('href')
      const ogUrl = $('meta[property="og:url"]').attr('content')
      const urlCandidate = canonicalUrl || ogUrl
      
      if (urlCandidate && urlCandidate.trim()) {
        websiteHostname = new URL(urlCandidate).hostname
      }
    } catch (error) {
      // If URL parsing fails, leave websiteHostname as undefined
      logger.warn('Failed to extract website hostname from canonical/og:url', { metadata: { error } })
    }

    return {
      email: emails[0] || undefined,
      phone: phones[0] || undefined,
      website: websiteHostname,
      socialLinks: socialLinks
    }
  }

  private extractSocialLinks($: cheerio.CheerioAPI): any[] {
    const socialPlatforms = ['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok', 'pinterest']
    const socialLinks: any[] = []

    $('a[href*="facebook.com"], a[href*="twitter.com"], a[href*="instagram.com"], a[href*="linkedin.com"], a[href*="youtube.com"], a[href*="tiktok.com"], a[href*="pinterest.com"]').each((_, element) => {
      const href = $(element).attr('href')
      if (href) {
        for (const platform of socialPlatforms) {
          if (href.includes(platform)) {
            socialLinks.push({
              platform: platform,
              url: href
            })
            break
          }
        }
      }
    })

    return socialLinks
  }

  private extractLocationInfo($: cheerio.CheerioAPI, html: string): any {
    // Look for address information
    const addressSelectors = [
      '[class*="address"]',
      '[class*="location"]',
      '[class*="contact"] address',
      'address'
    ]

    let address = ''
    for (const selector of addressSelectors) {
      const addressText = $(selector).text().trim()
      if (addressText && addressText.length > 10) {
        address = addressText
        break
      }
    }

    return {
      headquarters: {
        city: this.extractCityFromAddress(address),
        country: this.extractCountryFromAddress(address)
      }
    }
  }

  private extractCityFromAddress(address: string): string {
    // Simple city extraction logic (can be improved)
    const parts = address.split(',')
    if (parts.length >= 2) {
      return parts[parts.length - 2].trim()
    }
    return ''
  }

  private extractCountryFromAddress(address: string): string {
    // Simple country extraction logic (can be improved)
    const parts = address.split(',')
    if (parts.length >= 1) {
      const lastPart = parts[parts.length - 1].trim()
      if (lastPart.length === 2) return lastPart // Country code
      return lastPart
    }
    return ''
  }

  private analyzeSEO($: cheerio.CheerioAPI, html: string): SEOAnalysis {
    let score = 100
    const issues: string[] = []

    // Title tag analysis
    const title = $('title').text().trim()
    const titleScore = this.analyzeTitleTag(title, issues)

    // Meta description analysis
    const description = $('meta[name="description"]').attr('content')
    const descriptionScore = this.analyzeMetaDescription(description, issues)

    // Heading structure analysis
    const headingScore = this.analyzeHeadingStructure($, issues)

    // Image optimization
    const imageScore = this.analyzeImageOptimization($, issues)

    // Schema markup
    const schemaScore = this.analyzeSchemaMarkup(html, issues)

    // Calculate overall scores
    const technicalSEO = {
      pageSpeed: 75, // Would be calculated from performance metrics
      mobileOptimized: this.isMobileOptimized($),
      sslCertificate: true, // Assume HTTPS
      xmlSitemap: false, // Would need to check /sitemap.xml
      robotsTxt: false, // Would need to check /robots.txt
      schemaMarkup: schemaScore,
      canonicalTags: $('link[rel="canonical"]').length > 0 ? 100 : 0,
      metaTags: {
        titleTags: titleScore,
        metaDescriptions: descriptionScore,
        ogTags: this.analyzeOGTags($),
        schemaMarkup: schemaScore,
        canonicalTags: $('link[rel="canonical"]').length > 0 ? 100 : 0
      }
    }

    const contentSEO = {
      titleOptimization: titleScore,
      metaDescriptions: descriptionScore,
      headingStructure: headingScore,
      keywordDensity: 70, // Would need keyword analysis
      contentLength: this.calculateContentLength($),
      duplicateContent: 0, // Would need duplicate content check
      imageOptimization: imageScore
    }

    const localSEO = {
      googleMyBusiness: false, // Would need to check GMB API
      napConsistency: 70, // Would need NAP verification
      localCitations: 0, // Would need citation check
      reviewCount: 0, // Would need review aggregation
      averageRating: 0, // Would need review analysis
      localKeywordRankings: 50 // Would need keyword ranking check
    }

    // Calculate final score
    score = (titleScore + descriptionScore + headingScore + imageScore + schemaScore) / 5

    return {
      currentScore: Math.round(score),
      technicalSEO,
      contentSEO,
      localSEO,
      competitorSEOGap: 25, // Would need competitor analysis
      improvementOpportunities: this.generateSEOOpportunities(issues),
      keywordAnalysis: {
        primaryKeywords: [],
        secondaryKeywords: [],
        longTailOpportunities: [],
        competitorKeywords: [],
        keywordGaps: [],
        seasonalKeywords: []
      },
      backlinkAnalysis: {
        totalBacklinks: 0,
        domainAuthority: 50,
        linkQuality: 50,
        competitorGap: 25,
        linkBuildingOpportunities: []
      }
    }
  }

  private analyzeTitleTag(title: string, issues: string[]): number {
    if (!title) {
      issues.push('Missing title tag')
      return 0
    }
    if (title.length < 30) {
      issues.push('Title too short')
      return 60
    }
    if (title.length > 60) {
      issues.push('Title too long')
      return 70
    }
    return 100
  }

  private analyzeMetaDescription(description: string | undefined, issues: string[]): number {
    if (!description) {
      issues.push('Missing meta description')
      return 0
    }
    if (description.length < 120) {
      issues.push('Meta description too short')
      return 60
    }
    if (description.length > 160) {
      issues.push('Meta description too long')
      return 70
    }
    return 100
  }

  private analyzeHeadingStructure($: cheerio.CheerioAPI, issues: string[]): number {
    const h1Count = $('h1').length
    if (h1Count === 0) {
      issues.push('Missing H1 tag')
      return 0
    }
    if (h1Count > 1) {
      issues.push('Multiple H1 tags')
      return 60
    }
    return 100
  }

  private analyzeImageOptimization($: cheerio.CheerioAPI, issues: string[]): number {
    const images = $('img')
    const imagesWithoutAlt = $('img:not([alt])').length
    
    if (images.length === 0) return 100
    
    const optimizationScore = ((images.length - imagesWithoutAlt) / images.length) * 100
    
    if (imagesWithoutAlt > 0) {
      issues.push(`${imagesWithoutAlt} images missing alt tags`)
    }
    
    return Math.round(optimizationScore)
  }

  private analyzeSchemaMarkup(html: string, issues: string[]): number {
    const hasJsonLd = html.includes('application/ld+json')
    const hasMicrodata = html.includes('itemscope')
    
    if (!hasJsonLd && !hasMicrodata) {
      issues.push('Missing structured data')
      return 0
    }
    
    return hasJsonLd ? 100 : 50
  }

  private analyzeOGTags($: cheerio.CheerioAPI): number {
    const ogTags = $('meta[property^="og:"]').length
    return ogTags > 3 ? 100 : (ogTags * 25)
  }

  private isMobileOptimized($: cheerio.CheerioAPI): boolean {
    const viewport = $('meta[name="viewport"]').attr('content')
    return viewport ? viewport.includes('width=device-width') : false
  }

  private calculateContentLength($: cheerio.CheerioAPI): number {
    const textContent = $('body').text().replace(/\s+/g, ' ').trim()
    return textContent.split(' ').length
  }

  private generateSEOOpportunities(issues: string[]): any[] {
    return issues.map((issue, index) => ({
      type: 'technical' as const,
      description: issue,
      impact: 'medium' as const,
      effort: 'low' as const,
      priority: index + 1,
      estimatedTrafficIncrease: 10
    }))
  }

  private analyzeContent($: cheerio.CheerioAPI, html: string): ContentAnalysis {
    const textContent = $('body').text()
    
    return {
      readabilityScore: this.calculateReadabilityScore(textContent),
      sentimentScore: this.calculateSentimentScore(textContent),
      keyThemes: this.extractKeyThemes(textContent),
      contentGaps: [],
      expertiseIndicators: this.findExpertiseIndicators($),
      trustSignals: this.findTrustSignals($)
    }
  }

  private calculateReadabilityScore(text: string): number {
    // Simplified readability calculation
    const words = text.split(/\s+/).length
    const sentences = text.split(/[.!?]+/).length
    const avgWordsPerSentence = words / sentences
    
    if (avgWordsPerSentence < 15) return 90
    if (avgWordsPerSentence < 20) return 75
    if (avgWordsPerSentence < 25) return 60
    return 40
  }

  private calculateSentimentScore(text: string): number {
    // Simplified sentiment analysis
    const positiveWords = ['great', 'excellent', 'amazing', 'best', 'outstanding', 'professional', 'quality', 'reliable']
    const negativeWords = ['bad', 'poor', 'terrible', 'worst', 'awful', 'disappointing']
    
    const words = text.toLowerCase().split(/\s+/)
    const positive = words.filter(word => positiveWords.includes(word)).length
    const negative = words.filter(word => negativeWords.includes(word)).length
    
    return Math.min(100, Math.max(0, 50 + (positive - negative) * 10))
  }

  private extractKeyThemes(text: string): string[] {
    // Simplified theme extraction
    const words = text.toLowerCase().match(/\b\w+\b/g) || []
    const wordCount: { [key: string]: number } = {}
    
    words.forEach(word => {
      if (word.length > 4) {
        wordCount[word] = (wordCount[word] || 0) + 1
      }
    })
    
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word)
  }

  private findExpertiseIndicators($: cheerio.CheerioAPI): string[] {
    const indicators: string[] = []
    
    // Look for testimonials
    if ($('[class*="testimonial"]').length > 0) indicators.push('Customer testimonials')
    
    // Look for certifications
    if ($('[class*="certification"], [class*="badge"], [class*="award"]').length > 0) indicators.push('Industry certifications')
    
    // Look for team/about sections
    if ($('[class*="team"], [class*="about"]').length > 0) indicators.push('Team information')
    
    return indicators
  }

  private findTrustSignals($: cheerio.CheerioAPI): string[] {
    const signals: string[] = []
    
    // SSL certificate (assume HTTPS)
    signals.push('SSL certificate')
    
    // Contact information
    if ($('[class*="contact"]').length > 0) signals.push('Contact information')
    
    // Privacy policy
    if ($('a[href*="privacy"]').length > 0) signals.push('Privacy policy')
    
    // Terms of service
    if ($('a[href*="terms"]').length > 0) signals.push('Terms of service')
    
    return signals
  }

  private analyzeSocialPresence($: cheerio.CheerioAPI): SocialMediaPresence {
    const socialLinks = this.extractSocialLinks($)
    
    return {
      platforms: socialLinks.map(link => ({
        name: link.platform,
        url: link.url,
        followers: 0, // Would need API integration
        posts: 0,
        engagement: 0,
        contentType: []
      })),
      totalFollowers: 0,
      engagementRate: 0,
      contentStrategy: 'Unknown',
      influenceScore: socialLinks.length * 10 // Simple calculation
    }
  }

  private async analyzeTechStack($: cheerio.CheerioAPI, html: string, url: string): Promise<TechnologyStack> {
    const techStack: any = {
      website: {
        framework: this.detectFramework(html),
        cms: this.detectCMS(html),
        analytics: this.detectAnalytics(html),
        hosting: [],
        ssl: url.startsWith('https'),
        mobileOptimized: this.isMobileOptimized($),
        pageSpeed: 75 // Would be from performance metrics
      },
      analytics: this.detectAnalytics(html),
      marketing: this.detectMarketingTools(html),
      ecommerce: this.detectEcommerceTools(html)
    }

    return techStack
  }

  private detectFramework(html: string): string | undefined {
    if (html.includes('_next')) return 'Next.js'
    if (html.includes('nuxt')) return 'Nuxt.js'
    if (html.includes('ng-version')) return 'Angular'
    if (html.includes('data-reactroot')) return 'React'
    if (html.includes('v-cloak')) return 'Vue.js'
    return undefined
  }

  private detectCMS(html: string): string | undefined {
    if (html.includes('wp-content')) return 'WordPress'
    if (html.includes('drupal')) return 'Drupal'
    if (html.includes('joomla')) return 'Joomla'
    if (html.includes('shopify')) return 'Shopify'
    if (html.includes('squarespace')) return 'Squarespace'
    if (html.includes('wix.com')) return 'Wix'
    return undefined
  }

  private detectAnalytics(html: string): string[] {
    const analytics: string[] = []
    
    if (html.includes('google-analytics') || html.includes('gtag')) analytics.push('Google Analytics')
    if (html.includes('googletagmanager')) analytics.push('Google Tag Manager')
    if (html.includes('facebook.com/tr')) analytics.push('Facebook Pixel')
    if (html.includes('hotjar')) analytics.push('Hotjar')
    if (html.includes('mixpanel')) analytics.push('Mixpanel')
    
    return analytics
  }

  private detectMarketingTools(html: string): string[] {
    const marketing: string[] = []
    
    if (html.includes('mailchimp')) marketing.push('Mailchimp')
    if (html.includes('hubspot')) marketing.push('HubSpot')
    if (html.includes('intercom')) marketing.push('Intercom')
    if (html.includes('zendesk')) marketing.push('Zendesk')
    if (html.includes('drift')) marketing.push('Drift')
    
    return marketing
  }

  private detectEcommerceTools(html: string): string[] {
    const ecommerce: string[] = []
    
    if (html.includes('shopify')) ecommerce.push('Shopify')
    if (html.includes('woocommerce')) ecommerce.push('WooCommerce')
    if (html.includes('magento')) ecommerce.push('Magento')
    if (html.includes('bigcommerce')) ecommerce.push('BigCommerce')
    if (html.includes('stripe')) ecommerce.push('Stripe')
    if (html.includes('paypal')) ecommerce.push('PayPal')
    
    return ecommerce
  }

  private analyzeStructuredData($: cheerio.CheerioAPI): StructuredDataAnalysis {
    const jsonLdScripts = $('script[type="application/ld+json"]')
    const structuredData: any = {
      hasStructuredData: jsonLdScripts.length > 0,
      schemaTypes: [],
      jsonLdCount: jsonLdScripts.length,
      microdataCount: $('[itemscope]').length,
      organizationData: {},
      productData: [],
      breadcrumbs: []
    }

    // Parse JSON-LD data
    jsonLdScripts.each((_, script) => {
      try {
        const data = JSON.parse($(script).html() || '{}')
        if (data['@type']) {
          structuredData.schemaTypes.push(data['@type'])
        }
        
        // Extract organization data
        if (data['@type'] === 'Organization') {
          structuredData.organizationData = {
            name: data.name,
            description: data.description,
            url: data.url,
            logo: data.logo,
            address: data.address
          }
        }
      } catch (error) {
        // Invalid JSON-LD
      }
    })

    return structuredData
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }
}

// Default configuration
export const DEFAULT_ENHANCED_CONFIG: EnhancedAnalysisConfig = {
  timeout: 30000,
  maxRetries: 3,
  userAgent: 'DirectoryBolt Enhanced Analyzer/2.0 (Business Intelligence Engine)',
  enableScreenshots: true,
  enableSocialAnalysis: true,
  enableTechStackAnalysis: true,
  screenshotOptions: {
    fullPage: true,
    width: 1920,
    height: 1080,
    quality: 85,
    format: 'png'
  }
}

// Factory function
export function createEnhancedWebsiteAnalyzer(config?: Partial<EnhancedAnalysisConfig>): EnhancedWebsiteAnalyzer {
  return new EnhancedWebsiteAnalyzer({ ...DEFAULT_ENHANCED_CONFIG, ...config })
}
