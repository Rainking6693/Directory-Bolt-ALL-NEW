// 🤖 AI SUGGESTIONS API
// Generate intelligent suggestions for form fields using OpenAI

import { NextApiRequest, NextApiResponse } from 'next'
import OpenAI from 'openai'
import { logger } from '../../lib/utils/logger'

interface SuggestionRequest {
  field: string
  context: {
    businessName: string
    industry: string
    businessCategory: string
    businessModel: string
    currentValue?: string
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { field, context }: SuggestionRequest = req.body

    // Validate input
    if (!field || !context?.businessName || !context?.industry) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })

    if (!process.env.OPENAI_API_KEY) {
      // Return fallback suggestions if no API key
      return res.status(200).json(generateFallbackSuggestions(field, context))
    }

    // Generate AI suggestions based on field type
    let suggestions: string[] = []

    switch (field) {
      case 'description':
        suggestions = await generateDescriptionSuggestions(openai, context)
        break
      case 'uniqueSellingProposition':
        suggestions = await generateUSPSuggestions(openai, context)
        break
      case 'keyServices':
        suggestions = await generateServiceSuggestions(openai, context)
        break
      case 'targetAudience':
        suggestions = await generateAudienceSuggestions(openai, context)
        break
      case 'competitorFocus':
        suggestions = await generateCompetitorSuggestions(openai, context)
        break
      default:
        suggestions = generateFallbackSuggestions(field, context)
    }

    logger.info('AI suggestions generated', {
      metadata: { field, businessName: context.businessName, suggestionsCount: suggestions.length }
    })

    return res.status(200).json(suggestions)

  } catch (error) {
    logger.error('AI suggestions generation failed', {}, error as Error)
    
    // Return fallback suggestions on error
    const fallbackSuggestions = generateFallbackSuggestions(req.body.field, req.body.context)
    return res.status(200).json(fallbackSuggestions)
  }
}

async function generateDescriptionSuggestions(openai: OpenAI, context: any): Promise<string[]> {
  const prompt = `Generate 3 professional business descriptions for a ${context.industry} company called "${context.businessName}" that operates as a ${context.businessCategory} ${context.businessModel} business.

Each description should be:
- 2-3 sentences long
- Professional and engaging
- Highlight unique value proposition
- Include target audience
- Be specific to the ${context.industry} industry

Return only the descriptions, one per line, without numbering or bullets.`

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{
      role: "system",
      content: "You are an expert business copywriter. Generate compelling, professional business descriptions."
    }, {
      role: "user",
      content: prompt
    }],
    temperature: 0.7,
    max_tokens: 500
  })

  const response = completion.choices[0]?.message?.content
  if (response) {
    return response.split('\n').filter(line => line.trim().length > 0).slice(0, 3)
  }

  return generateFallbackSuggestions('description', context)
}

async function generateUSPSuggestions(openai: OpenAI, context: any): Promise<string[]> {
  const prompt = `Generate 3 unique selling propositions for "${context.businessName}", a ${context.industry} ${context.businessCategory} business.

Each USP should be:
- One compelling sentence
- Highlight what makes them different
- Focus on customer benefits
- Be specific to ${context.industry} industry
- Avoid generic claims

Return only the USPs, one per line.`

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{
      role: "system",
      content: "You are a marketing strategist specializing in unique selling propositions."
    }, {
      role: "user",
      content: prompt
    }],
    temperature: 0.8,
    max_tokens: 300
  })

  const response = completion.choices[0]?.message?.content
  if (response) {
    return response.split('\n').filter(line => line.trim().length > 0).slice(0, 3)
  }

  return generateFallbackSuggestions('uniqueSellingProposition', context)
}

async function generateServiceSuggestions(openai: OpenAI, context: any): Promise<string[]> {
  const prompt = `List 6 key services that a ${context.industry} ${context.businessCategory} business like "${context.businessName}" would typically offer.

Each service should be:
- Specific to the ${context.industry} industry
- Relevant for ${context.businessCategory} businesses
- Professional service names (2-4 words each)
- Common services in this industry

Return only the service names, one per line.`

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{
      role: "system",
      content: "You are a business consultant with deep industry knowledge."
    }, {
      role: "user",
      content: prompt
    }],
    temperature: 0.5,
    max_tokens: 300
  })

  const response = completion.choices[0]?.message?.content
  if (response) {
    return response.split('\n').filter(line => line.trim().length > 0).slice(0, 6)
  }

  return generateFallbackSuggestions('keyServices', context)
}

async function generateAudienceSuggestions(openai: OpenAI, context: any): Promise<string[]> {
  const prompt = `Identify 5 target audience segments for a ${context.industry} ${context.businessCategory} business like "${context.businessName}".

Each audience segment should be:
- Specific and well-defined
- Relevant to ${context.industry} industry
- Appropriate for ${context.businessCategory} businesses
- Include demographic or psychographic details

Return only the audience descriptions, one per line.`

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{
      role: "system",
      content: "You are a market research expert specializing in target audience identification."
    }, {
      role: "user",
      content: prompt
    }],
    temperature: 0.6,
    max_tokens: 400
  })

  const response = completion.choices[0]?.message?.content
  if (response) {
    return response.split('\n').filter(line => line.trim().length > 0).slice(0, 5)
  }

  return generateFallbackSuggestions('targetAudience', context)
}

async function generateCompetitorSuggestions(openai: OpenAI, context: any): Promise<string[]> {
  const prompt = `Identify 4 types of competitors that a ${context.industry} ${context.businessCategory} business like "${context.businessName}" should focus on analyzing.

Each competitor type should be:
- Specific to the ${context.industry} industry
- Relevant competitive threats
- Include both direct and indirect competitors
- Be actionable for competitive analysis

Return only the competitor types, one per line.`

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{
      role: "system",
      content: "You are a competitive intelligence analyst."
    }, {
      role: "user",
      content: prompt
    }],
    temperature: 0.5,
    max_tokens: 300
  })

  const response = completion.choices[0]?.message?.content
  if (response) {
    return response.split('\n').filter(line => line.trim().length > 0).slice(0, 4)
  }

  return generateFallbackSuggestions('competitorFocus', context)
}

function generateFallbackSuggestions(field: string, context: any): string[] {
  const businessName = context.businessName || 'Your Business'
  const industry = context.industry || 'Technology'
  const category = context.businessCategory || 'B2B'

  switch (field) {
    case 'description':
      return [
        `${businessName} is a leading ${industry.toLowerCase()} company that provides innovative solutions to help businesses grow and succeed in today's competitive market.`,
        `Specializing in ${industry.toLowerCase()} services, ${businessName} delivers exceptional value to ${category} clients through cutting-edge solutions and personalized support.`,
        `${businessName} combines industry expertise with innovative technology to provide comprehensive ${industry.toLowerCase()} solutions that drive measurable results for our clients.`
      ]

    case 'uniqueSellingProposition':
      return [
        `The only ${industry.toLowerCase()} solution that combines advanced technology with personalized service for guaranteed results.`,
        `Delivering 3x faster results than traditional ${industry.toLowerCase()} approaches through our proprietary methodology.`,
        `The most trusted ${industry.toLowerCase()} partner for ${category} businesses, with a proven track record of success.`
      ]

    case 'keyServices':
      if (industry === 'Technology') {
        return ['Software Development', 'System Integration', 'Technical Consulting', 'Cloud Solutions', 'Data Analytics', 'Cybersecurity']
      } else if (industry === 'Healthcare') {
        return ['Patient Care', 'Medical Consulting', 'Health Assessments', 'Treatment Planning', 'Preventive Care', 'Health Education']
      } else if (industry === 'Finance') {
        return ['Financial Planning', 'Investment Management', 'Risk Assessment', 'Tax Services', 'Business Consulting', 'Wealth Management']
      } else {
        return ['Consulting Services', 'Strategic Planning', 'Implementation Support', 'Training & Education', 'Ongoing Support', 'Custom Solutions']
      }

    case 'targetAudience':
      if (category === 'B2B') {
        return ['Small to medium businesses', 'Enterprise corporations', 'Startups and entrepreneurs', 'Industry professionals', 'Decision makers and executives']
      } else {
        return ['Individual consumers', 'Families and households', 'Young professionals', 'Retirees and seniors', 'Local community members']
      }

    case 'competitorFocus':
      return [
        `Direct ${industry.toLowerCase()} competitors`,
        'Industry market leaders',
        'Emerging startups and disruptors',
        'Alternative solution providers'
      ]

    default:
      return ['Professional solutions', 'Quality service', 'Expert support', 'Innovative approach']
  }
}