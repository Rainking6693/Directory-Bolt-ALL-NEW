import { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

interface AnalyzeRequest {
  url: string
  businessType?: string
  location?: string
}

interface GuideRecommendation {
  id: string
  title: string
  relevanceScore: number
  category: string
  difficulty: string
  estimatedReadTime: string
  keyBenefits: string[]
  priority: 'high' | 'medium' | 'low'
}

interface AnalyzeResponse {
  success: boolean
  url: string
  businessType?: string
  location?: string
  totalRecommendations: number
  recommendations: GuideRecommendation[]
  analysisTimestamp: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AnalyzeResponse | { error: string; success: false }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed. Use POST.',
      success: false 
    })
  }

  try {
    const { url, businessType, location }: AnalyzeRequest = req.body

    // Validate required fields
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        error: 'URL is required and must be a string',
        success: false
      })
    }

    // Basic URL validation
    if (!url.startsWith('http://') && !url.startsWith('https://') && url !== 'test') {
      return res.status(400).json({
        error: 'URL must start with http:// or https://',
        success: false
      })
    }

    // Load available guides
    const guidesDirectory = path.join(process.cwd(), 'data', 'guides')
    
    if (!fs.existsSync(guidesDirectory)) {
      return res.status(200).json({
        success: true,
        url,
        businessType,
        location,
        totalRecommendations: 0,
        recommendations: [],
        analysisTimestamp: new Date().toISOString()
      })
    }

    const guideFiles = fs.readdirSync(guidesDirectory).filter(file => file.endsWith('.json'))
    const recommendations: GuideRecommendation[] = []

    // Analyze each guide for relevance
    for (const file of guideFiles) {
      try {
        const filePath = path.join(guidesDirectory, file)
        const fileContent = fs.readFileSync(filePath, 'utf8')
        
        if (!fileContent.trim()) continue
        
        const guide = JSON.parse(fileContent)
        
        // Calculate relevance score based on URL analysis and business type
        const relevanceScore = calculateRelevanceScore(url, guide, businessType, location)
        
        if (relevanceScore > 0.3) { // Only include relevant guides
          recommendations.push({
            id: guide.id || path.basename(file, '.json'),
            title: guide.title || guide.directoryName || 'Untitled Guide',
            relevanceScore,
            category: guide.category || 'General',
            difficulty: guide.difficulty || 'beginner',
            estimatedReadTime: guide.estimatedReadTime || '5 min read',
            keyBenefits: generateKeyBenefits(guide),
            priority: relevanceScore > 0.8 ? 'high' : relevanceScore > 0.6 ? 'medium' : 'low'
          })
        }
      } catch (error) {
        console.warn(`Skipping invalid guide file: ${file}`, error)
        continue
      }
    }

    // Sort by relevance score (highest first)
    recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore)

    // Limit to top 10 recommendations
    const topRecommendations = recommendations.slice(0, 10)

    res.status(200).json({
      success: true,
      url,
      businessType,
      location,
      totalRecommendations: topRecommendations.length,
      recommendations: topRecommendations,
      analysisTimestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error analyzing URL for guide recommendations:', error)
    res.status(500).json({
      error: 'Failed to analyze URL and generate recommendations',
      success: false
    })
  }
}

function calculateRelevanceScore(
  url: string, 
  guide: any, 
  businessType?: string, 
  location?: string
): number {
  let score = 0.5 // Base score

  // For test URL, return varied scores for demonstration
  if (url === 'test') {
    return 0.7 + Math.random() * 0.3 // Random score between 0.7-1.0
  }

  // Analyze URL for platform-specific keywords
  const urlLower = url.toLowerCase()
  const guideTitleLower = (guide.title || guide.directoryName || '').toLowerCase()
  const guideCategory = (guide.category || '').toLowerCase()

  // Platform matching
  const platforms = [
    'google', 'facebook', 'instagram', 'twitter', 'linkedin', 'yelp', 
    'amazon', 'ebay', 'etsy', 'shopify', 'wordpress', 'youtube',
    'pinterest', 'tiktok', 'nextdoor', 'thumbtack', 'homeadvisor'
  ]

  for (const platform of platforms) {
    if (urlLower.includes(platform) && guideTitleLower.includes(platform)) {
      score += 0.4 // High relevance for platform match
      break
    }
  }

  // Business type matching
  if (businessType) {
    const businessTypeLower = businessType.toLowerCase()
    if (guideTitleLower.includes(businessTypeLower) || 
        guideCategory.includes(businessTypeLower)) {
      score += 0.2
    }
  }

  // Location-based scoring (local directories get higher scores for local businesses)
  if (location) {
    const localKeywords = ['local', 'directory', 'maps', 'places', 'neighborhood']
    if (localKeywords.some(keyword => guideTitleLower.includes(keyword))) {
      score += 0.1
    }
  }

  // Category-based relevance
  const popularCategories = [
    'local search', 'social media', 'e-commerce', 'professional networks'
  ]
  
  if (popularCategories.includes(guideCategory)) {
    score += 0.1
  }

  return Math.min(score, 1.0) // Cap at 1.0
}

function generateKeyBenefits(guide: any): string[] {
  const benefits = []
  
  // Generate benefits based on guide category and content
  const category = (guide.category || '').toLowerCase()
  
  if (category.includes('local')) {
    benefits.push('Improve local search visibility')
    benefits.push('Attract nearby customers')
  }
  
  if (category.includes('social')) {
    benefits.push('Increase social media presence')
    benefits.push('Engage with target audience')
  }
  
  if (category.includes('search') || category.includes('google')) {
    benefits.push('Boost search engine rankings')
    benefits.push('Drive organic traffic')
  }
  
  if (category.includes('review') || category.includes('yelp')) {
    benefits.push('Manage online reputation')
    benefits.push('Collect customer reviews')
  }
  
  if (category.includes('e-commerce') || category.includes('shop')) {
    benefits.push('Increase online sales')
    benefits.push('Reach new customers')
  }
  
  // Default benefits if none match
  if (benefits.length === 0) {
    benefits.push('Expand online presence')
    benefits.push('Build brand authority')
    benefits.push('Connect with customers')
  }
  
  return benefits.slice(0, 3) // Return max 3 benefits
}