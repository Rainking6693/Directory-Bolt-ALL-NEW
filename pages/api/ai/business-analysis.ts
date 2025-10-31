import { NextApiRequest, NextApiResponse } from 'next'

// Simple logger
const logger = {
  info: (msg: string, meta?: any) => console.log(`[INFO] ${msg}`, meta || ''),
  error: (msg: string, meta?: any, error?: Error) => console.error(`[ERROR] ${msg}`, meta || '', error || ''),
  warn: (msg: string, meta?: any) => console.warn(`[WARN] ${msg}`, meta || '')
}

interface BusinessAnalysisRequest {
  url: string
  tier: string
  businessInfo?: {
    name?: string
    industry?: string
    description?: string
  }
}

interface BusinessAnalysisResponse {
  success: boolean
  analysis: {
    businessProfile: {
      name: string
      industry: string
      category: string
      description: string
      targetAudience: string[]
      businessModel: string
      keyServices: string[]
      competitiveAdvantages: string[]
      marketPosition: string
    }
    competitiveAnalysis: {
      marketPosition: string
      competitorCount: number
      competitiveAdvantages: string[]
      marketGaps: string[]
      differentiationOpportunities: string[]
      threatLevel: string
      marketShare: string
    }
    seoAnalysis: {
      currentScore: number
      improvementAreas: string[]
      keywordOpportunities: string[]
      contentRecommendations: string[]
      technicalIssues: string[]
      localSEOOpportunities: string[]
    }
    marketInsights: {
      industryTrends: string[]
      growthOpportunities: string[]
      riskFactors: string[]
      recommendations: string[]
    }
    confidence: number
  }
  processingTime: number
  timestamp: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const startTime = Date.now()

  // Add timeout protection
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Analysis timeout')), 15000) // 15 second timeout
  })

  try {
    const result = await Promise.race([
      performBusinessAnalysis(req, res),
      timeoutPromise
    ])
    return result
  } catch (error) {
    logger.error('Business analysis failed', {
      metadata: {
        url: req.body?.url,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      }
    }, error as Error)

    if (error instanceof Error && error.message === 'Analysis timeout') {
      return res.status(504).json({
        success: false,
        error: 'Analysis timeout',
        message: 'The analysis took too long to complete. Please try again.',
        processingTime: Date.now() - startTime
      })
    }

    return res.status(500).json({
      success: false,
      error: 'Analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    })
  }
}

async function performBusinessAnalysis(req: NextApiRequest, res: NextApiResponse) {
  const startTime = Date.now()
  
  try {
    const { url, tier = 'free', businessInfo }: BusinessAnalysisRequest = req.body

    // Validate input
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Valid URL is required'
      })
    }

    // Basic URL validation
    let domain: string
    try {
      const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`)
      domain = parsedUrl.hostname
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      })
    }

    logger.info('Starting business analysis', {
      metadata: { url, domain, tier }
    })

    // Generate mock analysis response (no external API dependencies)
    const businessName = businessInfo?.name || extractBusinessNameFromDomain(domain)
    const industry = businessInfo?.industry || inferIndustryFromDomain(domain)
    const description = businessInfo?.description || `Professional ${industry.toLowerCase()} services provider`

    const analysis: BusinessAnalysisResponse['analysis'] = {
      businessProfile: {
        name: businessName,
        industry: industry,
        category: `${industry} Services`,
        description: description,
        targetAudience: generateTargetAudience(industry),
        businessModel: inferBusinessModel(industry),
        keyServices: generateKeyServices(industry),
        competitiveAdvantages: [
          'Professional service delivery',
          'Customer-focused approach',
          'Industry expertise',
          'Quality assurance'
        ],
        marketPosition: tier === 'free' ? 'Emerging Player' : 'Established Provider'
      },
      competitiveAnalysis: {
        marketPosition: `${tier === 'free' ? 'Growing presence' : 'Strong position'} in ${industry.toLowerCase()} market`,
        competitorCount: Math.floor(Math.random() * 50) + 20,
        competitiveAdvantages: [
          'Strong online presence potential',
          'Quality service reputation',
          'Customer satisfaction focus',
          'Professional expertise'
        ],
        marketGaps: [
          'Digital marketing optimization',
          'Directory presence enhancement',
          'Local SEO improvement',
          'Online review management'
        ],
        differentiationOpportunities: [
          'Enhanced directory listings',
          'Professional online presence',
          'Customer testimonial showcase',
          'Service specialization'
        ],
        threatLevel: 'Medium',
        marketShare: `Small but ${tier === 'free' ? 'growing' : 'established'} market presence`
      },
      seoAnalysis: {
        currentScore: Math.floor(Math.random() * 30) + (tier === 'free' ? 35 : 55),
        improvementAreas: [
          'Meta descriptions optimization',
          'Title tag enhancement',
          'Content quality improvement',
          'Local SEO optimization',
          'Page speed optimization'
        ],
        keywordOpportunities: generateKeywords(industry, domain),
        contentRecommendations: [
          'Create industry-specific content',
          'Add customer testimonials',
          'Develop service pages',
          'Write regular blog posts',
          'Add FAQ section'
        ],
        technicalIssues: [
          'Mobile responsiveness check',
          'Page load speed optimization',
          'Schema markup implementation',
          'SSL certificate verification',
          'Internal linking structure'
        ],
        localSEOOpportunities: [
          'Google My Business optimization',
          'Local directory submissions',
          'Customer review acquisition',
          'Local keyword targeting',
          'NAP consistency improvement'
        ]
      },
      marketInsights: {
        industryTrends: generateIndustryTrends(industry),
        growthOpportunities: [
          'Digital presence expansion',
          'Directory optimization',
          'Local market penetration',
          'Service differentiation',
          'Customer experience enhancement'
        ],
        riskFactors: [
          'Increased competition',
          'Market saturation',
          'Changing customer expectations',
          'Technology disruption'
        ],
        recommendations: [
          'Optimize directory presence across major platforms',
          'Improve local SEO and Google My Business listing',
          'Develop customer review acquisition strategy',
          'Create industry-specific content marketing',
          'Enhance mobile user experience'
        ]
      },
      confidence: tier === 'free' ? 0.7 : 0.85
    }

    const response: BusinessAnalysisResponse = {
      success: true,
      analysis,
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }

    logger.info('Business analysis completed', {
      metadata: {
        url,
        domain,
        businessName,
        industry,
        confidence: analysis.confidence,
        processingTime: response.processingTime
      }
    })

    return res.status(200).json(response)

  } catch (error) {
    logger.error('Business analysis processing failed', {
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })
    throw error
  }
}

function extractBusinessNameFromDomain(domain: string): string {
  // Remove www. and common TLD extensions
  const cleaned = domain
    .replace(/^www\./, '')
    .replace(/\.(com|org|net|io|co|biz|info)$/, '')
    .replace(/[-_]/g, ' ')
  
  // Capitalize first letter of each word
  return cleaned
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function inferIndustryFromDomain(domain: string): string {
  const domainLower = domain.toLowerCase()
  
  if (domainLower.includes('tech') || domainLower.includes('software') || domainLower.includes('app')) {
    return 'Technology'
  } else if (domainLower.includes('health') || domainLower.includes('medical') || domainLower.includes('care')) {
    return 'Healthcare'
  } else if (domainLower.includes('real') && domainLower.includes('estate')) {
    return 'Real Estate'
  } else if (domainLower.includes('law') || domainLower.includes('legal') || domainLower.includes('attorney')) {
    return 'Legal Services'
  } else if (domainLower.includes('finance') || domainLower.includes('accounting') || domainLower.includes('tax')) {
    return 'Financial Services'
  } else if (domainLower.includes('market') || domainLower.includes('agency') || domainLower.includes('media')) {
    return 'Marketing & Advertising'
  } else if (domainLower.includes('consult')) {
    return 'Consulting'
  } else if (domainLower.includes('design') || domainLower.includes('creative')) {
    return 'Design & Creative'
  } else {
    return 'Professional Services'
  }
}

function generateTargetAudience(industry: string): string[] {
  const audiences: { [key: string]: string[] } = {
    'Technology': ['Tech Companies', 'Startups', 'Enterprise Businesses', 'SMBs'],
    'Healthcare': ['Patients', 'Healthcare Providers', 'Medical Professionals', 'Insurance Companies'],
    'Real Estate': ['Homebuyers', 'Sellers', 'Investors', 'Property Managers'],
    'Legal Services': ['Individuals', 'Small Businesses', 'Corporations', 'Non-profits'],
    'Financial Services': ['Individuals', 'Small Businesses', 'Corporations', 'Investors'],
    'Marketing & Advertising': ['Small Businesses', 'E-commerce', 'Professional Services', 'B2B Companies'],
    'Consulting': ['Executives', 'Management Teams', 'Growing Companies', 'Enterprise Clients'],
    'Design & Creative': ['Small Businesses', 'Startups', 'Marketing Agencies', 'E-commerce'],
    'Professional Services': ['Small Businesses', 'Professionals', 'Corporate Clients', 'Local Community']
  }
  
  return audiences[industry] || audiences['Professional Services']
}

function inferBusinessModel(industry: string): string {
  const models: { [key: string]: string } = {
    'Technology': 'SaaS/Technology Provider',
    'Healthcare': 'Healthcare Service Provider',
    'Real Estate': 'Real Estate Services',
    'Legal Services': 'Professional Services',
    'Financial Services': 'Financial Advisory',
    'Marketing & Advertising': 'Agency/Service Provider',
    'Consulting': 'Consulting Services',
    'Design & Creative': 'Creative Services',
    'Professional Services': 'Service Provider'
  }
  
  return models[industry] || 'Service Provider'
}

function generateKeyServices(industry: string): string[] {
  const services: { [key: string]: string[] } = {
    'Technology': ['Software Development', 'System Integration', 'Technical Support', 'Consulting'],
    'Healthcare': ['Patient Care', 'Medical Consultation', 'Treatment Services', 'Preventive Care'],
    'Real Estate': ['Property Sales', 'Property Management', 'Real Estate Consultation', 'Market Analysis'],
    'Legal Services': ['Legal Consultation', 'Document Preparation', 'Representation', 'Legal Advice'],
    'Financial Services': ['Financial Planning', 'Investment Advisory', 'Tax Services', 'Accounting'],
    'Marketing & Advertising': ['Digital Marketing', 'Brand Strategy', 'Content Creation', 'Campaign Management'],
    'Consulting': ['Business Strategy', 'Process Improvement', 'Management Consulting', 'Advisory Services'],
    'Design & Creative': ['Graphic Design', 'Web Design', 'Branding', 'Creative Services'],
    'Professional Services': ['Professional Consultation', 'Service Delivery', 'Client Support', 'Expertise']
  }
  
  return services[industry] || services['Professional Services']
}

function generateKeywords(industry: string, domain: string): string[] {
  const baseKeywords = [
    `${industry.toLowerCase()} services`,
    `professional ${industry.toLowerCase()}`,
    `${industry.toLowerCase()} company`,
    `${industry.toLowerCase()} expert`
  ]
  
  // Add domain-based keywords
  const domainKeywords = domain
    .replace(/\.(com|org|net|io|co|biz|info)$/, '')
    .replace(/^www\./, '')
    .split(/[-_]/)
    .filter(part => part.length > 2)
    .map(part => `${part} services`)
  
  return [...baseKeywords, ...domainKeywords].slice(0, 6)
}

function generateIndustryTrends(industry: string): string[] {
  const trends: { [key: string]: string[] } = {
    'Technology': ['AI/ML Integration', 'Cloud Migration', 'Cybersecurity Focus', 'Remote Work Solutions'],
    'Healthcare': ['Telemedicine Growth', 'Digital Health Records', 'Patient-Centered Care', 'Preventive Medicine'],
    'Real Estate': ['Virtual Tours', 'PropTech Adoption', 'Sustainable Buildings', 'Remote Property Management'],
    'Legal Services': ['Legal Tech Adoption', 'Remote Legal Services', 'Automation', 'Client Self-Service'],
    'Financial Services': ['Digital Banking', 'Fintech Integration', 'Cryptocurrency', 'Robo-Advisors'],
    'Marketing & Advertising': ['Digital Marketing Dominance', 'Personalization', 'Video Content', 'AI-Powered Analytics'],
    'Consulting': ['Digital Transformation', 'Remote Consulting', 'Specialized Expertise', 'Data-Driven Insights'],
    'Design & Creative': ['UX/UI Focus', 'Brand Experience', 'Digital-First Design', 'Sustainable Design'],
    'Professional Services': ['Digital Transformation', 'Online Service Delivery', 'Client Experience Focus', 'Specialization']
  }
  
  return trends[industry] || trends['Professional Services']
}