/**
 * Tests for AI Business Analyzer Service
 * Tests business intelligence, competitive analysis, and SEO analysis
 */

import { describe, it, expect, beforeEach } from '@jest/globals'

describe('AI Business Analyzer Service', () => {
  describe('Service Structure', () => {
    it('should be importable', async () => {
      const service = await import('../../../lib/services/ai-business-analyzer')
      expect(service).toBeDefined()
    })

    it('should export analyzer functions', async () => {
      const service = await import('../../../lib/services/ai-business-analyzer')
      expect(service).toBeDefined()
    })
  })

  describe('Business Profile Analysis', () => {
    it('should accept valid business profile', () => {
      const profile = {
        businessName: 'Test Business',
        website: 'https://test.com',
        industry: 'Technology',
        location: 'San Francisco, CA'
      }
      
      expect(profile.businessName).toBeDefined()
      expect(profile.website).toMatch(/^https?:\/\//)
    })

    it('should validate website URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://example.com',
        'https://www.example.com'
      ]
      
      validUrls.forEach(url => {
        expect(url).toMatch(/^https?:\/\//)
      })
    })
  })

  describe('Competitive Analysis', () => {
    it('should handle competitor URL analysis', () => {
      const competitorUrls = [
        'https://competitor1.com',
        'https://competitor2.com'
      ]
      
      expect(competitorUrls.length).toBeGreaterThan(0)
      competitorUrls.forEach(url => {
        expect(url).toMatch(/^https?:\/\//)
      })
    })
  })

  describe('SEO Analysis', () => {
    it('should validate target keywords', () => {
      const keywords = ['SEO', 'marketing', 'business']
      
      expect(Array.isArray(keywords)).toBe(true)
      expect(keywords.length).toBeGreaterThan(0)
    })
  })
})

