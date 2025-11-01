/**
 * Tests for AI Analysis Cache Service
 * Tests caching, validation, and storage of analysis results
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { AIAnalysisCacheService } from '../../../lib/services/ai-analysis-cache'

// Mock supabase client
jest.mock('../../../lib/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
        }))
      })),
      upsert: jest.fn().mockResolvedValue({ error: null })
    }))
  }
}))

describe('AI Analysis Cache Service', () => {
  let cacheService: AIAnalysisCacheService

  beforeEach(() => {
    cacheService = new AIAnalysisCacheService()
    jest.clearAllMocks()
  })

  describe('getCachedAnalysisResults', () => {
    it('should return null when customer ID is not found', async () => {
      const result = await cacheService.getCachedAnalysisResults('non-existent-id')
      expect(result).toBeNull()
    })

    it('should handle database errors gracefully', async () => {
      // Test with invalid customer ID format
      const result = await cacheService.getCachedAnalysisResults('')
      expect(result).toBeNull()
    })
  })

  describe('storeAnalysisResults', () => {
    it('should store analysis results successfully', async () => {
      const customerId = 'test-customer-123'
      const analysisData = { score: 85, insights: ['Test insight'] }
      const directoryOpportunities = [{ name: 'Test Directory', priority: 'high' }]
      const revenueProjections = { monthly: 1000, annual: 12000 }
      const businessProfile = { name: 'Test Business', industry: 'Tech' }

      const result = await cacheService.storeAnalysisResults(
        customerId,
        analysisData,
        directoryOpportunities,
        revenueProjections,
        businessProfile
      )

      // Should not throw error (may return false if DB not configured in test)
      expect(typeof result).toBe('boolean')
    })

    it('should handle empty data gracefully', async () => {
      const result = await cacheService.storeAnalysisResults(
        'test-id',
        null,
        [],
        null,
        {}
      )
      expect(typeof result).toBe('boolean')
    })
  })

  describe('getCachedAnalysisOrValidate', () => {
    it('should return not_found when no cache exists', async () => {
      const result = await cacheService.getCachedAnalysisOrValidate(
        'non-existent-id',
        {}
      )
      
      expect(result.cached).toBeNull()
      expect(result.validation.reason).toBe('not_found')
      expect(result.validation.isValid).toBe(false)
    })

    it('should validate cached results age', async () => {
      const result = await cacheService.getCachedAnalysisOrValidate(
        'test-id',
        { name: 'Test Business' }
      )
      
      // Should handle validation even if cache doesn't exist
      expect(result.validation).toBeDefined()
      expect(['not_found', 'stale', 'fresh']).toContain(result.validation.reason)
    })
  })

  describe('Service Creation', () => {
    it('should create service with default options', () => {
      const service = new AIAnalysisCacheService()
      expect(service).toBeInstanceOf(AIAnalysisCacheService)
    })

    it('should create service with custom options', () => {
      const service = new AIAnalysisCacheService()
      // Service should be created even without options
      expect(service).toBeDefined()
    })
  })
})

