/**
 * Trigger.dev Task: Analyze Website
 * 
 * Migrated from analyze API to Trigger.dev task.
 * Processes website analysis with real AI services.
 */

import { task } from "@trigger.dev/sdk/v3"
import { enhancedWebsiteScraper } from "../../lib/services/enhanced-website-scraper"
import { aiBusinessProfiler } from "../../lib/services/ai-business-profiler"
import { competitiveIntelligenceService } from "../../lib/services/competitive-intelligence"
import { seoAuditService } from "../../lib/services/seo-audit-service"

interface AnalyzeWebsitePayload {
  url: string
  customerId: string
  tier: string
}

export const analyzeWebsiteTask = task({
  id: "analyze-website",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
  },
  run: async (payload: AnalyzeWebsitePayload, { ctx }) => {
    const { url, customerId, tier } = payload

    // Scrape website
    const scrapedData = await enhancedWebsiteScraper.scrapeWebsite(url)

    // SEO audit
    const seoAudit = await seoAuditService.auditWebsite(scrapedData)

    // AI profiling (for paid tiers)
    let businessProfile
    if (tier !== 'free') {
      businessProfile = await aiBusinessProfiler.generateBusinessProfile(scrapedData)
    }

    // Competitive analysis (for Growth+ tiers)
    let competitiveAnalysis
    if (tier !== 'free' && tier !== 'starter' && businessProfile) {
      competitiveAnalysis = await competitiveIntelligenceService.analyzeCompetitors(
        businessProfile,
        scrapedData
      )
    }

    return {
      success: true,
      customerId,
      url,
      tier,
      seoScore: seoAudit.overallScore,
      businessProfile,
      competitiveAnalysis,
      scrapedData: {
        businessName: scrapedData.businessName,
        services: scrapedData.services,
        socialMedia: scrapedData.socialMedia,
        existingDirectoryListings: scrapedData.existingDirectoryListings.length
      }
    }
  },
})
