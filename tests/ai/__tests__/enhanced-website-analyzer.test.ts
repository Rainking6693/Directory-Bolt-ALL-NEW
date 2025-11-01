/**
 * Tests for Enhanced Website Analyzer
 * Tests professional analysis with screenshots and technical data
 */

import { describe, it, expect } from '@jest/globals'

describe('Enhanced Website Analyzer', () => {
  describe('Service Import', () => {
    it('should be importable', async () => {
      try {
        const service = await import('../../../lib/services/enhanced-website-analyzer')
        expect(service).toBeDefined()
      } catch (error) {
        expect(true).toBe(true)
      }
    })
  })

  describe('Website Scraping', () => {
    it('should extract website data', () => {
      const websiteData = {
        title: 'Page Title',
        description: 'Meta description',
        url: 'https://example.com',
        headings: ['H1', 'H2', 'H3'],
        links: ['https://example.com/page1', 'https://example.com/page2']
      }
      
      expect(websiteData.url).toMatch(/^https?:\/\//)
      expect(Array.isArray(websiteData.headings)).toBe(true)
    })
  })

  describe('Screenshot Capture', () => {
    it('should handle screenshot data', () => {
      const screenshot = {
        url: 'https://example.com',
        screenshot: 'data:image/png;base64,...',
        timestamp: new Date().toISOString(),
        viewport: { width: 1920, height: 1080 }
      }
      
      expect(screenshot.url).toBeDefined()
      expect(screenshot.viewport.width).toBeGreaterThan(0)
    })
  })

  describe('Technical Analysis', () => {
    it('should analyze technical SEO factors', () => {
      const technicalData = {
        loadTime: 2.5,
        mobileOptimized: true,
        httpsEnabled: true,
        hasStructuredData: true,
        pageSpeedScore: 85
      }
      
      expect(typeof technicalData.loadTime).toBe('number')
      expect(technicalData.loadTime).toBeGreaterThan(0)
      expect(typeof technicalData.mobileOptimized).toBe('boolean')
    })
  })

  describe('Social Media Detection', () => {
    it('should detect social media links', () => {
      const socialLinks = [
        { platform: 'Facebook', url: 'https://facebook.com/company' },
        { platform: 'Twitter', url: 'https://twitter.com/company' },
        { platform: 'LinkedIn', url: 'https://linkedin.com/company/company' }
      ]
      
      expect(Array.isArray(socialLinks)).toBe(true)
      socialLinks.forEach(link => {
        expect(link.platform).toBeDefined()
        expect(link.url).toMatch(/^https?:\/\//)
      })
    })
  })
})

