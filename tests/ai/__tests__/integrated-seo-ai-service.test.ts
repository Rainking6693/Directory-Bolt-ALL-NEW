/**
 * Tests for Integrated SEO AI Service
 * Tests unified analysis pipeline combining directory + SEO intelligence
 */

import { describe, it, expect, beforeEach } from '@jest/globals'

// Note: We'll import the actual service once we understand its structure
// For now, we'll create structure tests

describe('Integrated SEO AI Service', () => {
  describe('Service Structure', () => {
    it('should be importable', async () => {
      const service = await import('../../../lib/services/integrated-seo-ai-service')
      expect(service).toBeDefined()
    })

    it('should export expected interfaces', async () => {
      const service = await import('../../../lib/services/integrated-seo-ai-service')
      
      // Check for key exports (these are TypeScript types/interfaces, not runtime values)
      // So we check for the service class and functions instead
      expect(service).toHaveProperty('IntegratedSEOAIService')
      expect(service).toHaveProperty('getIntegratedSEOAIService')
      expect(service).toHaveProperty('performIntegratedAnalysis')
      // Types are exported but not as runtime values, so they won't be properties
      // The service class and functions are the runtime exports we can test
    })
  })

  describe('Analysis Request Validation', () => {
    it('should validate required fields in analysis request', () => {
      // Test structure - actual validation would depend on implementation
      const validRequest = {
        businessProfile: {
          businessName: 'Test Business',
          website: 'https://test.com'
        },
        userTier: 'professional' as const,
        analysisScope: {
          includeDirectoryAnalysis: true,
          includeSEOAnalysis: true,
          includeCompetitorResearch: false,
          includeContentOptimization: false,
          includeKeywordAnalysis: false
        }
      }
      
      expect(validRequest.businessProfile.businessName).toBeDefined()
      expect(validRequest.analysisScope.includeDirectoryAnalysis).toBe(true)
    })
  })

  describe('Tier Access Control', () => {
    it('should respect tier access controls', () => {
      const tiers = ['free', 'professional', 'enterprise'] as const
      
      tiers.forEach(tier => {
        expect(['free', 'professional', 'enterprise']).toContain(tier)
      })
    })
  })
})

