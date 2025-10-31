// 🎯 DIRECTORY MATCHER SERVICE
// AI-powered directory matching and success probability calculation

import OpenAI from 'openai'
import { logger } from '../utils/logger'
import type { BusinessProfile } from '../types/ai.types'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface DirectoryOpportunity {
  id: string
  name: string
  url: string
  submissionUrl?: string
  category: string
  authority: number
  estimatedTraffic: number
  submissionDifficulty: 'Easy' | 'Medium' | 'Hard'
  cost: number
  successProbability: number
  reasoning: string
  requirements: string[]
  benefits: string[]
  timeToApproval: string
  isPremium: boolean
}

export interface DirectoryMatchingResult {
  totalOpportunities: number
  freeOpportunities: DirectoryOpportunity[]
  premiumOpportunities: DirectoryOpportunity[]
  recommendedStrategy: string
  expectedROI: {
    conservative: number
    optimistic: number
    timeframe: string
  }
}

export class DirectoryMatcher {
  private static instance: DirectoryMatcher
  private directoryDatabase: DirectoryOpportunity[] = []

  public static getInstance(): DirectoryMatcher {
    if (!DirectoryMatcher.instance) {
      DirectoryMatcher.instance = new DirectoryMatcher()
    }
    return DirectoryMatcher.instance
  }

  constructor() {
    this.initializeDirectoryDatabase()
  }

  /**
   * Initialize comprehensive directory database
   */
  private initializeDirectoryDatabase() {
    this.directoryDatabase = [
      // High Authority General Directories
      {
        id: 'google-my-business',
        name: 'Google My Business',
        url: 'https://business.google.com',
        submissionUrl: 'https://business.google.com/create',
        category: 'Local Business',
        authority: 100,
        estimatedTraffic: 50000,
        submissionDifficulty: 'Easy',
        cost: 0,
        successProbability: 95,
        reasoning: 'Essential for local SEO and Google visibility',
        requirements: ['Business address', 'Phone number', 'Business hours'],
        benefits: ['Google Maps listing', 'Local search visibility', 'Customer reviews'],
        timeToApproval: '1-3 days',
        isPremium: false
      },
      {
        id: 'yelp',
        name: 'Yelp',
        url: 'https://yelp.com',
        submissionUrl: 'https://biz.yelp.com',
        category: 'Local Business',
        authority: 94,
        estimatedTraffic: 25000,
        submissionDifficulty: 'Easy',
        cost: 0,
        successProbability: 90,
        reasoning: 'Major local business directory with high consumer trust',
        requirements: ['Business information', 'Photos'],
        benefits: ['Customer reviews', 'Local visibility', 'Mobile app presence'],
        timeToApproval: 'Immediate',
        isPremium: false
      },
      {
        id: 'facebook-business',
        name: 'Facebook Business',
        url: 'https://facebook.com',
        submissionUrl: 'https://business.facebook.com',
        category: 'Social Media',
        authority: 96,
        estimatedTraffic: 30000,
        submissionDifficulty: 'Easy',
        cost: 0,
        successProbability: 95,
        reasoning: 'Largest social media platform for business presence',
        requirements: ['Business information', 'Cover photo'],
        benefits: ['Social media presence', 'Customer engagement', 'Advertising platform'],
        timeToApproval: 'Immediate',
        isPremium: false
      },

      // Industry-Specific Directories
      {
        id: 'better-business-bureau',
        name: 'Better Business Bureau',
        url: 'https://bbb.org',
        submissionUrl: 'https://apply.bbb.org',
        category: 'Business Verification',
        authority: 88,
        estimatedTraffic: 15000,
        submissionDifficulty: 'Medium',
        cost: 500,
        successProbability: 75,
        reasoning: 'Builds trust and credibility with consumers',
        requirements: ['Business license', 'Operating history', 'Fee payment'],
        benefits: ['Trust badge', 'Complaint resolution', 'Credibility boost'],
        timeToApproval: '2-4 weeks',
        isPremium: true
      },
      {
        id: 'angie-list',
        name: 'Angie\'s List',
        url: 'https://angieslist.com',
        submissionUrl: 'https://pro.angieslist.com',
        category: 'Home Services',
        authority: 85,
        estimatedTraffic: 12000,
        submissionDifficulty: 'Medium',
        cost: 0,
        successProbability: 70,
        reasoning: 'Leading platform for home service providers',
        requirements: ['Service area', 'License verification', 'Insurance'],
        benefits: ['Qualified leads', 'Customer reviews', 'Background check badge'],
        timeToApproval: '1-2 weeks',
        isPremium: false
      },

      // Tech & SaaS Directories
      {
        id: 'product-hunt',
        name: 'Product Hunt',
        url: 'https://producthunt.com',
        submissionUrl: 'https://producthunt.com/posts/new',
        category: 'Tech Launch',
        authority: 91,
        estimatedTraffic: 8000,
        submissionDifficulty: 'Medium',
        cost: 0,
        successProbability: 60,
        reasoning: 'Premier platform for tech product launches',
        requirements: ['Product demo', 'High-quality images', 'Compelling description'],
        benefits: ['Tech community exposure', 'Early adopter feedback', 'Media attention'],
        timeToApproval: '1-3 days',
        isPremium: false
      },
      {
        id: 'g2-crowd',
        name: 'G2',
        url: 'https://g2.com',
        submissionUrl: 'https://sell.g2.com',
        category: 'Software Reviews',
        authority: 89,
        estimatedTraffic: 15000,
        submissionDifficulty: 'Easy',
        cost: 0,
        successProbability: 85,
        reasoning: 'Leading B2B software review platform',
        requirements: ['Software product', 'Company information'],
        benefits: ['Software reviews', 'Buyer intent data', 'Competitive analysis'],
        timeToApproval: '3-5 days',
        isPremium: false
      },
      {
        id: 'capterra',
        name: 'Capterra',
        url: 'https://capterra.com',
        submissionUrl: 'https://vendor.capterra.com',
        category: 'Software Directory',
        authority: 87,
        estimatedTraffic: 18000,
        submissionDifficulty: 'Easy',
        cost: 0,
        successProbability: 80,
        reasoning: 'Major software discovery platform for businesses',
        requirements: ['Software product', 'Pricing information'],
        benefits: ['Software listings', 'Lead generation', 'Market visibility'],
        timeToApproval: '1-2 weeks',
        isPremium: false
      },

      // Professional Services
      {
        id: 'linkedin-company',
        name: 'LinkedIn Company Page',
        url: 'https://linkedin.com',
        submissionUrl: 'https://linkedin.com/company/setup',
        category: 'Professional Network',
        authority: 98,
        estimatedTraffic: 20000,
        submissionDifficulty: 'Easy',
        cost: 0,
        successProbability: 95,
        reasoning: 'Essential professional networking platform',
        requirements: ['Company information', 'Logo', 'Description'],
        benefits: ['Professional networking', 'Talent acquisition', 'B2B connections'],
        timeToApproval: 'Immediate',
        isPremium: false
      },
      {
        id: 'clutch',
        name: 'Clutch',
        url: 'https://clutch.co',
        submissionUrl: 'https://clutch.co/profile/add',
        category: 'B2B Services',
        authority: 84,
        estimatedTraffic: 8000,
        submissionDifficulty: 'Medium',
        cost: 0,
        successProbability: 70,
        reasoning: 'Leading B2B service provider directory',
        requirements: ['Portfolio', 'Client references', 'Case studies'],
        benefits: ['B2B leads', 'Industry recognition', 'Client reviews'],
        timeToApproval: '2-3 weeks',
        isPremium: false
      },

      // Niche Industry Directories
      {
        id: 'houzz',
        name: 'Houzz',
        url: 'https://houzz.com',
        submissionUrl: 'https://pro.houzz.com',
        category: 'Home & Design',
        authority: 86,
        estimatedTraffic: 12000,
        submissionDifficulty: 'Medium',
        cost: 0,
        successProbability: 75,
        reasoning: 'Premier platform for home design and renovation',
        requirements: ['Portfolio', 'Professional photos', 'License verification'],
        benefits: ['Design project leads', 'Portfolio showcase', 'Homeowner connections'],
        timeToApproval: '1-2 weeks',
        isPremium: false
      },
      {
        id: 'thumbtack',
        name: 'Thumbtack',
        url: 'https://thumbtack.com',
        submissionUrl: 'https://pro.thumbtack.com',
        category: 'Local Services',
        authority: 82,
        estimatedTraffic: 10000,
        submissionDifficulty: 'Easy',
        cost: 0,
        successProbability: 80,
        reasoning: 'Popular platform for local service providers',
        requirements: ['Service description', 'Pricing', 'Availability'],
        benefits: ['Local leads', 'Customer matching', 'Payment processing'],
        timeToApproval: '1-3 days',
        isPremium: false
      },

      // Additional High-Value Directories
      {
        id: 'yellow-pages',
        name: 'Yellow Pages',
        url: 'https://yellowpages.com',
        submissionUrl: 'https://listings.yellowpages.com',
        category: 'General Business',
        authority: 80,
        estimatedTraffic: 8000,
        submissionDifficulty: 'Easy',
        cost: 0,
        successProbability: 90,
        reasoning: 'Established business directory with strong local presence',
        requirements: ['Business information', 'Contact details'],
        benefits: ['Local visibility', 'Phone directory listing', 'Online presence'],
        timeToApproval: '1-5 days',
        isPremium: false
      },
      {
        id: 'foursquare',
        name: 'Foursquare',
        url: 'https://foursquare.com',
        submissionUrl: 'https://business.foursquare.com',
        category: 'Location-Based',
        authority: 78,
        estimatedTraffic: 6000,
        submissionDifficulty: 'Easy',
        cost: 0,
        successProbability: 85,
        reasoning: 'Location-based discovery platform',
        requirements: ['Business location', 'Hours', 'Photos'],
        benefits: ['Location discovery', 'Check-in features', 'Local recommendations'],
        timeToApproval: '1-3 days',
        isPremium: false
      }
    ]

    logger.info('Directory database initialized', {
      metadata: { totalDirectories: this.directoryDatabase.length }
    })
  }

  /**
   * Find matching directories for a business profile
   */
  async findMatchingDirectories(
    businessProfile: BusinessProfile, 
    tier: 'free' | 'paid' = 'free'
  ): Promise<DirectoryMatchingResult> {
    try {
      logger.info('Starting directory matching', {
        metadata: { 
          businessName: businessProfile.name,
          industry: businessProfile.industry,
          tier 
        }
      })

      // Calculate success probabilities for each directory
      const scoredDirectories = await this.scoreDirectories(businessProfile)

      // Sort by success probability and authority
      const sortedDirectories = scoredDirectories.sort((a, b) => {
        const scoreA = (a.successProbability * 0.7) + (a.authority * 0.3)
        const scoreB = (b.successProbability * 0.7) + (b.authority * 0.3)
        return scoreB - scoreA
      })

      // Separate free and premium opportunities
      const freeOpportunities = sortedDirectories.filter(d => d.cost === 0)
      const premiumOpportunities = sortedDirectories.filter(d => d.cost > 0)

      // Apply tier limitations
      let limitedFreeOpportunities = freeOpportunities
      let limitedPremiumOpportunities = premiumOpportunities

      if (tier === 'free') {
        // Free tier: limit to 5 directories, no premium
        limitedFreeOpportunities = freeOpportunities.slice(0, 5)
        limitedPremiumOpportunities = []
      } else {
        // Paid tier: full access
        limitedFreeOpportunities = freeOpportunities.slice(0, 50)
        limitedPremiumOpportunities = premiumOpportunities.slice(0, 20)
      }

      // Generate strategy and ROI
      const strategy = await this.generateSubmissionStrategy(businessProfile, limitedFreeOpportunities)
      const expectedROI = this.calculateExpectedROI(limitedFreeOpportunities, limitedPremiumOpportunities)

      const result: DirectoryMatchingResult = {
        totalOpportunities: limitedFreeOpportunities.length + limitedPremiumOpportunities.length,
        freeOpportunities: limitedFreeOpportunities,
        premiumOpportunities: limitedPremiumOpportunities,
        recommendedStrategy: strategy,
        expectedROI
      }

      logger.info('Directory matching completed', {
        metadata: {
          businessName: businessProfile.name,
          totalOpportunities: result.totalOpportunities,
          freeOpportunities: result.freeOpportunities.length,
          premiumOpportunities: result.premiumOpportunities.length
        }
      })

      return result

    } catch (error) {
      logger.error('Directory matching failed', {}, error as Error)
      throw error
    }
  }

  /**
   * Score directories based on business profile match
   */
  private async scoreDirectories(businessProfile: BusinessProfile): Promise<DirectoryOpportunity[]> {
    const scoredDirectories: DirectoryOpportunity[] = []

    for (const directory of this.directoryDatabase) {
      try {
        // Calculate base success probability
        let successProbability = directory.successProbability

        // Adjust based on business profile match
        const categoryMatch = this.calculateCategoryMatch(businessProfile, directory)
        const industryMatch = this.calculateIndustryMatch(businessProfile, directory)
        
        // Apply adjustments
        successProbability = Math.min(95, successProbability * categoryMatch * industryMatch)

        // Generate AI reasoning for the match
        const reasoning = await this.generateMatchReasoning(businessProfile, directory, successProbability)

        scoredDirectories.push({
          ...directory,
          successProbability: Math.round(successProbability),
          reasoning
        })

      } catch (error) {
        logger.error(`Failed to score directory ${directory.name}`, {}, error as Error)
        
        // Add with default scoring
        scoredDirectories.push({
          ...directory,
          successProbability: Math.round(directory.successProbability * 0.8),
          reasoning: `Good fit for ${businessProfile.industry} businesses`
        })
      }
    }

    return scoredDirectories
  }

  /**
   * Calculate category match score
   */
  private calculateCategoryMatch(businessProfile: BusinessProfile, directory: DirectoryOpportunity): number {
    const businessCategories = [
      businessProfile.industry.toLowerCase(),
      businessProfile.category.toLowerCase(),
      ...(businessProfile.keyServices ?? []).map(s => s.toLowerCase())
    ]

    const directoryCategory = directory.category.toLowerCase()

    // Check for exact matches
    if (businessCategories.some(cat => directoryCategory.includes(cat))) {
      return 1.2 // 20% boost for category match
    }

    // Check for general business directories
    if (directoryCategory.includes('general') || directoryCategory.includes('business')) {
      return 1.0 // Neutral for general directories
    }

    // Partial penalty for category mismatch
    return 0.9
  }

  /**
   * Calculate industry match score
   */
  private calculateIndustryMatch(businessProfile: BusinessProfile, directory: DirectoryOpportunity): number {
    const industry = businessProfile.industry.toLowerCase()
    const directoryName = directory.name.toLowerCase()
    const directoryCategory = directory.category.toLowerCase()

    // Tech/Software matches
    if (industry.includes('tech') || industry.includes('software') || industry.includes('saas')) {
      if (directoryName.includes('product') || directoryName.includes('g2') || directoryName.includes('capterra')) {
        return 1.3 // Strong match for tech directories
      }
    }

    // Home services matches
    if (industry.includes('home') || industry.includes('construction') || industry.includes('repair')) {
      if (directoryName.includes('angie') || directoryName.includes('houzz') || directoryName.includes('thumbtack')) {
        return 1.3 // Strong match for home service directories
      }
    }

    // Professional services matches
    if (industry.includes('professional') || industry.includes('consulting') || industry.includes('legal')) {
      if (directoryName.includes('linkedin') || directoryName.includes('clutch')) {
        return 1.2 // Good match for professional directories
      }
    }

    return 1.0 // Neutral for no specific match
  }

  /**
   * Generate AI reasoning for directory match
   */
  private async generateMatchReasoning(
    businessProfile: BusinessProfile, 
    directory: DirectoryOpportunity, 
    successProbability: number
  ): Promise<string> {
    try {
      const prompt = `
Generate a brief explanation for why this directory is a good match for this business:

Business: ${businessProfile.name}
Industry: ${businessProfile.industry}
Category: ${businessProfile.category}

Directory: ${directory.name}
Category: ${directory.category}
Authority: ${directory.authority}
Success Probability: ${successProbability}%

Provide a 1-2 sentence explanation focusing on the specific benefits for this business type.`

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 150,
      })

      return response.choices[0]?.message?.content || directory.reasoning

    } catch (error) {
      // Fallback to template reasoning
      return `Excellent opportunity for ${businessProfile.industry} businesses to increase visibility and reach ${directory.category.toLowerCase()} audience`
    }
  }

  /**
   * Generate submission strategy
   */
  private async generateSubmissionStrategy(
    businessProfile: BusinessProfile, 
    directories: DirectoryOpportunity[]
  ): Promise<string> {
    try {
      const topDirectories = directories.slice(0, 5).map(d => d.name).join(', ')
      
      const prompt = `
Create a directory submission strategy for this business:

Business: ${businessProfile.name}
Industry: ${businessProfile.industry}
Top Directories: ${topDirectories}

Provide a 2-3 sentence strategy focusing on prioritization and expected outcomes.`

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
      })

      return response.choices[0]?.message?.content || 
        `Start with high-authority directories like ${topDirectories.split(', ')[0]}, then expand to industry-specific platforms. Focus on complete profiles with quality images and descriptions.`

    } catch (error) {
      return `Prioritize high-authority directories first, then expand to industry-specific platforms for maximum visibility and lead generation.`
    }
  }

  /**
   * Calculate expected ROI
   */
  private calculateExpectedROI(freeOpportunities: DirectoryOpportunity[], premiumOpportunities: DirectoryOpportunity[]) {
    const totalTraffic = [...freeOpportunities, ...premiumOpportunities]
      .reduce((sum, dir) => sum + (dir.estimatedTraffic * dir.successProbability / 100), 0)

    const conservativeROI = Math.round(totalTraffic * 0.02 * 50) // 2% conversion, $50 value
    const optimisticROI = Math.round(totalTraffic * 0.05 * 100) // 5% conversion, $100 value

    return {
      conservative: conservativeROI,
      optimistic: optimisticROI,
      timeframe: '6 months'
    }
  }
}

export default DirectoryMatcher

// Export configuration
export const DEFAULT_DIRECTORY_MATCHING_CONFIG = {
  enablePremiumDirectories: true,
  maxDirectoryCount: 50,
  focusOnHighAuthority: true,
  includeNicheDirectories: true
}
