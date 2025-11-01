/**
 * Phase 3.2: Enhanced AI Integration Service
 *
 * This service orchestrates the complete AI-enhanced DirectoryBolt workflow,
 * connecting the AI Business Intelligence Engine, caching system,
 * and customer dashboard functionality.
 */

import { differenceInDays, parseISO, formatISO } from 'date-fns'
import { supabase } from './supabase'

const CACHE_TABLE = 'analysis_cache'
const STALE_THRESHOLD_DAYS = 30

// Type definition for the cache table row
interface AnalysisCacheRow {
  customer_id: string
  analysis_data: any
  directory_opportunities: any
  revenue_projections: any
  business_profile: any
  last_updated: string
}

export interface CachedAnalysisRecord {
  customerId: string
  analysisData: any
  directoryOpportunities: any
  revenueProjections: any
  businessProfile: any
  lastUpdated: string
}

export interface AIAnalysisCacheOptions {
  cacheExpiryDays?: number
  minConfidenceScore?: number
}

export class AIAnalysisCacheService {
  async getCachedAnalysisResults(customerId: string): Promise<CachedAnalysisRecord | null> {
    const { data, error } = await (supabase as any)
      .from(CACHE_TABLE)
      .select(
        `customer_id, analysis_data, directory_opportunities, revenue_projections, business_profile, last_updated`
      )
      .eq('customer_id', customerId)
      .maybeSingle()

    if (error) {
      console.error('[AIAnalysisCacheService] Failed to read cache', { customerId, error })
      return null
    }

    if (!data) {
      return null
    }

    // Type assertion to fix TypeScript error when table doesn't exist in generated types
    const cacheRow = data as AnalysisCacheRow

    return {
      customerId: cacheRow.customer_id,
      analysisData: cacheRow.analysis_data,
      directoryOpportunities: cacheRow.directory_opportunities,
      revenueProjections: cacheRow.revenue_projections,
      businessProfile: cacheRow.business_profile,
      lastUpdated: cacheRow.last_updated
    }
  }

  async storeAnalysisResults(
    customerId: string,
    analysisData: any,
    directoryOpportunities: any,
    revenueProjections: any,
    businessProfile: any
  ): Promise<boolean> {
    const payload = {
      customer_id: customerId,
      analysis_data: analysisData,
      directory_opportunities: directoryOpportunities,
      revenue_projections: revenueProjections,
      business_profile: businessProfile,
      last_updated: formatISO(new Date())
    }

    const { error } = await (supabase as any)
      .from(CACHE_TABLE)
      .upsert(payload, { onConflict: 'customer_id' })

    if (error) {
      console.error('[AIAnalysisCacheService] Failed to upsert cache', { customerId, error })
      return false
    }

    return true
  }

  async getCachedAnalysisOrValidate(
    customerId: string,
    currentBusinessData: any
  ): Promise<{
    cached: CachedAnalysisRecord | null
    validation: {
      isValid: boolean
      daysOld?: number
      reason: 'fresh' | 'stale' | 'not_found'
    }
  }> {
    const cachedRecord = await this.getCachedAnalysisResults(customerId)

    if (!cachedRecord) {
        return {
          cached: null,
          validation: {
            isValid: false,
            reason: 'not_found'
          }
        }
      }

    const lastUpdated = parseISO(cachedRecord.lastUpdated)
    const daysOld = differenceInDays(new Date(), lastUpdated)
      
    if (Number.isNaN(daysOld) || daysOld > STALE_THRESHOLD_DAYS) {
        return {
          cached: null,
          validation: {
            isValid: false,
            reason: 'stale',
          daysOld: Number.isNaN(daysOld) ? undefined : daysOld
          }
        }
      }

        return {
      cached: cachedRecord,
        validation: {
          isValid: true,
          reason: 'fresh',
        daysOld
      }
    }
  }
}

export function createAIAnalysisCacheService(_options?: AIAnalysisCacheOptions): AIAnalysisCacheService {
  return new AIAnalysisCacheService()
}

export default createAIAnalysisCacheService
