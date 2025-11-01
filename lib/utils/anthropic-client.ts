/**
 * Anthropic API Client Utility
 * 
 * Provides a unified Anthropic client for AI services.
 * Uses Anthropic for complex tasks, falls back to Gemini for simpler tasks.
 */

import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { logger } from './logger'

let anthropicClient: Anthropic | null = null
let geminiClient: GoogleGenerativeAI | null = null

/**
 * Initialize Anthropic client
 */
export function initializeAnthropic(): Anthropic | null {
  if (anthropicClient) {
    return anthropicClient
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    logger.warn('Anthropic API key not found. Complex AI features will be limited.')
    return null
  }

  try {
    anthropicClient = new Anthropic({ apiKey })
    logger.info('Anthropic client initialized successfully')
    return anthropicClient
  } catch (error) {
    logger.error('Failed to initialize Anthropic client', {}, error as Error)
    return null
  }
}

/**
 * Initialize Gemini client
 */
export function initializeGemini(): GoogleGenerativeAI | null {
  if (geminiClient) {
    return geminiClient
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    logger.warn('Gemini API key not found. Simple AI features will be limited.')
    return null
  }

  try {
    geminiClient = new GoogleGenerativeAI(apiKey)
    logger.info('Gemini client initialized successfully')
    return geminiClient
  } catch (error) {
    logger.error('Failed to initialize Gemini client', {}, error as Error)
    return null
  }
}

/**
 * Get Anthropic client (initializes if needed)
 */
export function getAnthropicClient(): Anthropic | null {
  return anthropicClient || initializeAnthropic()
}

/**
 * Get Gemini client (initializes if needed)
 */
export function getGeminiClient(): GoogleGenerativeAI | null {
  return geminiClient || initializeGemini()
}

/**
 * Check if Anthropic is available
 */
export function isAnthropicAvailable(): boolean {
  return !!getAnthropicClient()
}

/**
 * Check if Gemini is available
 */
export function isGeminiAvailable(): boolean {
  return !!getGeminiClient()
}

/**
 * Call Anthropic API for complex tasks
 */
export async function callAnthropic(
  prompt: string,
  options: {
    model?: string
    maxTokens?: number
    temperature?: number
    systemPrompt?: string
  } = {}
): Promise<string> {
  const client = getAnthropicClient()
  if (!client) {
    throw new Error('Anthropic client not available')
  }

  const {
    model = 'claude-3-sonnet-20241022',
    maxTokens = 4000,
    temperature = 0.3,
    systemPrompt = 'You are a helpful AI assistant.'
  } = options

  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      return content.text
    }

    throw new Error('Unexpected response format from Anthropic')
  } catch (error) {
    logger.error('Anthropic API call failed', {}, error as Error)
    throw error
  }
}

/**
 * Call Gemini API for simpler tasks
 */
export async function callGemini(
  prompt: string,
  options: {
    model?: string
    maxOutputTokens?: number
    temperature?: number
  } = {}
): Promise<string> {
  const client = getGeminiClient()
  if (!client) {
    throw new Error('Gemini client not available')
  }

  const {
    model = 'gemini-pro',
    maxOutputTokens = 2000,
    temperature = 0.4
  } = options

  try {
    const genModel = client.getGenerativeModel({ model })
    const result = await genModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens,
        temperature
      }
    })

    const response = await result.response
    return response.text()
  } catch (error) {
    logger.error('Gemini API call failed', {}, error as Error)
    throw error
  }
}

/**
 * Smart AI call - uses Anthropic for complex tasks, Gemini for simple tasks
 */
export async function callAI(
  prompt: string,
  taskComplexity: 'simple' | 'complex' = 'complex',
  options: {
    anthropicModel?: string
    geminiModel?: string
    maxTokens?: number
    temperature?: number
    systemPrompt?: string
  } = {}
): Promise<string> {
  if (taskComplexity === 'simple') {
    try {
      return await callGemini(prompt, {
        model: options.geminiModel,
        maxOutputTokens: options.maxTokens,
        temperature: options.temperature
      })
    } catch (error) {
      logger.warn('Gemini call failed, falling back to Anthropic', { error: error instanceof Error ? error.message : String(error) })
      // Fallback to Anthropic if Gemini fails
      return await callAnthropic(prompt, {
        model: options.anthropicModel,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        systemPrompt: options.systemPrompt
      })
    }
  } else {
    // Complex tasks use Anthropic
    return await callAnthropic(prompt, {
      model: options.anthropicModel,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      systemPrompt: options.systemPrompt
    })
  }
}

// Initialize clients on module load
if (typeof window === 'undefined') {
  initializeAnthropic()
  initializeGemini()
}

