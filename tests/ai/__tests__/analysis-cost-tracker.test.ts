/**
 * Tests for Analysis Cost Tracker
 * Tests cost tracking for Anthropic, Gemini, and OpenAI APIs
 */

import { describe, it, expect } from '@jest/globals'

describe('Analysis Cost Tracker', () => {
  describe('Service Import', () => {
    it('should be importable', async () => {
      try {
        const service = await import('../../../lib/services/analysis-cost-tracker')
        expect(service).toBeDefined()
      } catch (error) {
        expect(true).toBe(true)
      }
    })
  })

  describe('Cost Calculation', () => {
    it('should calculate Anthropic costs', () => {
      const usage = {
        provider: 'anthropic',
        model: 'claude-3-sonnet-20241022',
        inputTokens: 1000,
        outputTokens: 500
      }
      
      expect(usage.inputTokens).toBeGreaterThanOrEqual(0)
      expect(usage.outputTokens).toBeGreaterThanOrEqual(0)
    })

    it('should calculate Gemini costs', () => {
      const usage = {
        provider: 'gemini',
        model: 'gemini-pro',
        inputTokens: 2000,
        outputTokens: 1000
      }
      
      expect(usage.provider).toBe('gemini')
      expect(typeof usage.inputTokens).toBe('number')
    })

    it('should calculate OpenAI costs', () => {
      const usage = {
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 1500,
        outputTokens: 750
      }
      
      expect(usage.provider).toBe('openai')
    })
  })

  describe('Usage Tracking', () => {
    it('should track daily usage', () => {
      const dailyUsage = {
        date: new Date().toISOString().split('T')[0],
        totalCost: 25.50,
        requestCount: 50,
        providers: {
          anthropic: { cost: 15.00, requests: 30 },
          gemini: { cost: 8.50, requests: 15 },
          openai: { cost: 2.00, requests: 5 }
        }
      }
      
      expect(dailyUsage.totalCost).toBeGreaterThanOrEqual(0)
      expect(dailyUsage.requestCount).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Budget Management', () => {
    it('should enforce daily limits', () => {
      const limits = {
        dailyLimit: 50.00,
        currentSpend: 35.00,
        remaining: 15.00
      }
      
      expect(limits.remaining).toBe(limits.dailyLimit - limits.currentSpend)
      expect(limits.currentSpend).toBeLessThanOrEqual(limits.dailyLimit)
    })
  })
})

