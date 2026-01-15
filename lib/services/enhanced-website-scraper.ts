/**
 * Enhanced Website Scraper
 * 
 * Robust URL scraper using cheerio to extract comprehensive business data:
 * - Business name, address, phone (NAP data)
 * - Services/products offered
 * - Team information
 * - Social media profiles
 * - Existing directory listings
 * - Meta data (description, keywords, OG tags)
 */

import axios from 'axios'
import * as cheerio from 'cheerio'
import { logger } from '../utils/logger'

export interface ScrapedBusinessData {
  // Basic Info
  url: string
  title: string
  description: string
  businessName: string
  
  // NAP Data (Name, Address, Phone)
  name?: string
  address?: string
  phone?: string
  email?: string
  
  // Services & Products
  services: string[]
  products: string[]
  keyServices: string[]
  
  // Team & About
  teamMembers?: string[]
  aboutText?: string
  
  // Social Media
  socialMedia: {
    facebook?: string
    twitter?: string
    instagram?: string
    linkedin?: string
    youtube?: string
  }
  
  // Existing Listings
  existingDirectoryListings: string[]
  
  // Content
  h1: string[]
  h2: string[]
  keywords: string[]
  metaKeywords?: string
  
  // Links
  internalLinks: string[]
  externalLinks: string[]
  
  // Technical
  hasContactForm: boolean
  hasLocation: boolean
  structuredData?: any
}

const DEFAULT_TIMEOUT = 15000
const MAX_TEXT_LENGTH = 10000

/**
 * Enhanced website scraper with business data extraction
 */
export class EnhancedWebsiteScraper {
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

  /**
   * Scrape website and extract comprehensive business data
   */
  async scrapeWebsite(url: string): Promise<ScrapedBusinessData> {
    try {
      const normalizedUrl = this.normalizeUrl(url)
      logger.info('Starting website scrape', { url: normalizedUrl })

      const response = await axios.get(normalizedUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: DEFAULT_TIMEOUT,
        maxRedirects: 5,
        validateStatus: (status) => status < 500
      })

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const $ = cheerio.load(response.data)
      const domain = new URL(normalizedUrl).hostname

      // Extract basic metadata
      const title = $('title').text().trim() || domain
      const description = $('meta[name="description"]').attr('content') || 
                         $('meta[property="og:description"]').attr('content') || ''
      const businessName = this.extractBusinessName(title, domain, $)

      // Extract NAP data (Name, Address, Phone)
      const napData = this.extractNAPData($, normalizedUrl)

      // Extract services and products
      const { services, products, keyServices } = this.extractServicesAndProducts($)

      // Extract team information
      const teamMembers = this.extractTeamMembers($)

      // Extract social media links
      const socialMedia = this.extractSocialMedia($, normalizedUrl)

      // Detect existing directory listings
      const existingDirectoryListings = this.detectExistingListings($, normalizedUrl)

      // Extract content structure
      const h1 = $('h1').map((_, el) => $(el).text().trim()).get()
      const h2 = $('h2').map((_, el) => $(el).text().trim()).get()
      const metaKeywords = $('meta[name="keywords"]').attr('content') || ''
      const keywords = this.extractKeywords($, metaKeywords)

      // Extract links
      const { internalLinks, externalLinks } = this.extractLinks($, normalizedUrl)

      // Check for common elements
      const hasContactForm = $('form').length > 0 || 
                            $('[class*="contact"]').length > 0 ||
                            $('[id*="contact"]').length > 0
      const hasLocation = $('[class*="address"]').length > 0 ||
                         $('[class*="location"]').length > 0 ||
                         $('[itemprop="address"]').length > 0

      // Extract structured data (JSON-LD)
      const structuredData = this.extractStructuredData($)

      // Extract about text
      const aboutText = this.extractAboutText($)

      const result: ScrapedBusinessData = {
        url: normalizedUrl,
        title,
        description,
        businessName,
        ...napData,
        services,
        products,
        keyServices,
        teamMembers,
        aboutText,
        socialMedia,
        existingDirectoryListings,
        h1,
        h2,
        keywords,
        metaKeywords: metaKeywords || undefined,
        internalLinks,
        externalLinks,
        hasContactForm,
        hasLocation,
        structuredData
      }

      logger.info('Website scrape completed', {
        url: normalizedUrl,
        businessName: result.businessName,
        servicesCount: services.length,
        socialCount: Object.keys(socialMedia).length
      })

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Website scraping failed', { url, error: errorMessage }, error as Error)
      throw new Error(`Failed to scrape website: ${errorMessage}`)
    }
  }

  /**
   * Normalize URL (add protocol if missing, etc.)
   */
  private normalizeUrl(url: string): string {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`
    }
    return url
  }

  /**
   * Extract business name from title, domain, or structured data
   */
  private extractBusinessName(title: string, domain: string, $: cheerio.CheerioAPI): string {
    // Try structured data first
    const structuredName = $('[itemprop="name"]').first().text().trim() ||
                          $('h1').first().text().trim()

    if (structuredName) {
      return structuredName.substring(0, 100)
    }

    // Try to extract from title (remove common suffixes)
    const titleParts = title.replace(/[-|–—]\s*(Home|Welcome|Official|Website).*$/i, '').trim()
    if (titleParts.length > 3 && titleParts.length < 80) {
      return titleParts
    }

    // Fallback to domain
    const domainParts = domain.replace('www.', '').split('.')
    return domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1)
  }

  /**
   * Extract NAP data (Name, Address, Phone)
   */
  private extractNAPData($: cheerio.CheerioAPI, baseUrl: string): {
    name?: string
    address?: string
    phone?: string
    email?: string
  } {
    const result: { name?: string; address?: string; phone?: string; email?: string } = {}

    // Extract name
    result.name = $('[itemprop="name"]').first().text().trim() ||
                 $('.business-name').first().text().trim() ||
                 $('[class*="company-name"]').first().text().trim()

    // Extract address
    const addressText = $('[itemprop="address"]').first().text().trim() ||
                       $('[itemprop="streetAddress"]').text().trim() ||
                       $('[class*="address"]').first().text().trim() ||
                       $('[class*="location"]').first().text().trim()
    
    if (addressText) {
      result.address = addressText.replace(/\s+/g, ' ').trim()
    }

    // Extract phone
    const phonePattern = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g
    const phoneMatches = $('body').text().match(phonePattern)
    if (phoneMatches && phoneMatches.length > 0) {
      result.phone = phoneMatches[0].trim()
    }

    // Extract email
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    const emailMatches = $('body').text().match(emailPattern)
    if (emailMatches && emailMatches.length > 0) {
      // Prefer contact emails over generic ones
      const contactEmail = emailMatches.find(email => 
        email.includes('contact') || email.includes('info') || email.includes('hello')
      )
      result.email = (contactEmail || emailMatches[0]).toLowerCase()
    }

    return result
  }

  /**
   * Extract services and products from page content
   */
  private extractServicesAndProducts($: cheerio.CheerioAPI): {
    services: string[]
    products: string[]
    keyServices: string[]
  } {
    const services: string[] = []
    const products: string[] = []
    
    // Common patterns for services/products sections
    const serviceSelectors = [
      '[class*="service"]',
      '[class*="offering"]',
      '[class*="solution"]',
      '[id*="service"]',
      '[id*="services"]',
      '[data-service]'
    ]

    const productSelectors = [
      '[class*="product"]',
      '[class*="item"]',
      '[id*="product"]',
      '[id*="products"]',
      '[data-product]'
    ]

    // Extract from service sections
    serviceSelectors.forEach(selector => {
      $(selector).each((_, el) => {
        const text = $(el).text().trim()
        if (text.length > 10 && text.length < 200) {
          services.push(text)
        }
      })
    })

    // Extract from product sections
    productSelectors.forEach(selector => {
      $(selector).each((_, el) => {
        const text = $(el).text().trim()
        if (text.length > 10 && text.length < 200) {
          products.push(text)
        }
      })
    })

    // Extract from list items
    $('ul li, ol li').each((_, el) => {
      const text = $(el).text().trim()
      if (text.length > 5 && text.length < 150) {
        if (/service|solution|offering/i.test(text)) {
          services.push(text)
        } else if (/product|item/i.test(text)) {
          products.push(text)
        }
      }
    })

    // Get key services (first 5 unique)
    const keyServices = [...new Set(services)].slice(0, 5)

    return {
      services: [...new Set(services)].slice(0, 20),
      products: [...new Set(products)].slice(0, 20),
      keyServices
    }
  }

  /**
   * Extract team member information
   */
  private extractTeamMembers($: cheerio.CheerioAPI): string[] {
    const members: string[] = []

    const teamSelectors = [
      '[class*="team"]',
      '[class*="staff"]',
      '[id*="team"]',
      '[data-team]'
    ]

    teamSelectors.forEach(selector => {
      $(selector).find('h2, h3, h4, .name, [class*="name"]').each((_, el) => {
        const name = $(el).text().trim()
        if (name.length > 2 && name.length < 80 && !members.includes(name)) {
          members.push(name)
        }
      })
    })

    return members.slice(0, 10)
  }

  /**
   * Extract social media links
   */
  private extractSocialMedia($: cheerio.CheerioAPI, baseUrl: string): ScrapedBusinessData['socialMedia'] {
    const socialMedia: ScrapedBusinessData['socialMedia'] = {}
    const links = $('a[href]').map((_, el) => $(el).attr('href')).get()

    const socialPatterns = {
      facebook: /facebook\.com\/([^/?]+)/i,
      twitter: /(?:twitter|x)\.com\/([^/?]+)/i,
      instagram: /instagram\.com\/([^/?]+)/i,
      linkedin: /linkedin\.com\/(?:company|in)\/([^/?]+)/i,
      youtube: /(?:youtube\.com\/(?:channel\/|user\/|@)|youtu\.be\/)([^/?]+)/i
    }

    links.forEach(link => {
      if (!link) return

      // Resolve relative URLs
      let fullUrl = link
      try {
        fullUrl = new URL(link, baseUrl).href
      } catch {
        return
      }

      for (const [platform, pattern] of Object.entries(socialPatterns)) {
        const match = fullUrl.match(pattern)
        if (match && !socialMedia[platform as keyof typeof socialMedia]) {
          socialMedia[platform as keyof typeof socialMedia] = fullUrl
        }
      }
    })

    return socialMedia
  }

  /**
   * Detect existing directory listings by looking for directory links/badges
   */
  private detectExistingListings($: cheerio.CheerioAPI, baseUrl: string): string[] {
    const listings: string[] = []
    const links = $('a[href]').map((_, el) => {
      const href = $(el).attr('href')
      const text = $(el).text().trim().toLowerCase()
      return { href, text }
    }).get()

    // Common directory patterns
    const directoryPatterns = [
      /yelp\.com/i,
      /google\.com\/maps/i,
      /facebook\.com/i,
      /yellowpages\.com/i,
      /bbb\.org/i,
      /foursquare\.com/i,
      /tripadvisor\.com/i
    ]

    links.forEach(({ href, text }) => {
      if (!href) return

      directoryPatterns.forEach(pattern => {
        if (pattern.test(href) && !listings.includes(href)) {
          listings.push(href)
        }
      })
    })

    return listings.slice(0, 10)
  }

  /**
   * Extract keywords from content and meta tags
   */
  private extractKeywords($: cheerio.CheerioAPI, metaKeywords: string): string[] {
    const keywords: Set<string> = new Set()

    // Add meta keywords
    if (metaKeywords) {
      metaKeywords.split(',').forEach(kw => {
        const trimmed = kw.trim().toLowerCase()
        if (trimmed.length > 2) keywords.add(trimmed)
      })
    }

    // Extract from common tags
    $('h1, h2, h3, strong, b, [class*="tag"], [class*="category"]').each((_, el) => {
      const text = $(el).text().trim().toLowerCase()
      if (text.length > 2 && text.length < 50) {
        keywords.add(text)
      }
    })

    return Array.from(keywords).slice(0, 30)
  }

  /**
   * Extract and categorize links
   */
  private extractLinks($: cheerio.CheerioAPI, baseUrl: string): {
    internalLinks: string[]
    externalLinks: string[]
  } {
    const internalLinks: string[] = []
    const externalLinks: string[] = []
    const baseDomain = new URL(baseUrl).hostname

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')
      if (!href || href.startsWith('#')) return

      try {
        const fullUrl = new URL(href, baseUrl).href
        const linkDomain = new URL(fullUrl).hostname

        if (linkDomain === baseDomain || linkDomain.includes(baseDomain)) {
          if (!internalLinks.includes(fullUrl)) {
            internalLinks.push(fullUrl)
          }
        } else {
          if (!externalLinks.includes(fullUrl)) {
            externalLinks.push(fullUrl)
          }
        }
      } catch {
        // Invalid URL, skip
      }
    })

    return {
      internalLinks: internalLinks.slice(0, 50),
      externalLinks: externalLinks.slice(0, 50)
    }
  }

  /**
   * Extract structured data (JSON-LD)
   */
  private extractStructuredData($: cheerio.CheerioAPI): any {
    const scripts = $('script[type="application/ld+json"]')
    if (scripts.length === 0) return undefined

    try {
      const jsonLd = JSON.parse(scripts.first().html() || '{}')
      return jsonLd
    } catch {
      return undefined
    }
  }

  /**
   * Extract about/description text
   */
  private extractAboutText($: cheerio.CheerioAPI): string | undefined {
    const aboutSelectors = [
      '[class*="about"]',
      '[id*="about"]',
      '[class*="description"]',
      '[class*="intro"]',
      'main p'
    ]

    for (const selector of aboutSelectors) {
      const text = $(selector).first().text().trim()
      if (text.length > 100) {
        return text.substring(0, MAX_TEXT_LENGTH).trim()
      }
    }

    // Fallback: get first few paragraphs
    const paragraphs = $('p').map((_, el) => $(el).text().trim()).get()
    const combined = paragraphs.slice(0, 3).join(' ').trim()
    return combined.length > 100 ? combined.substring(0, MAX_TEXT_LENGTH) : undefined
  }
}

// Export singleton instance
export const enhancedWebsiteScraper = new EnhancedWebsiteScraper()
