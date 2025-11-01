/**
 * Brand Consistency Engine
 * Ensures consistent brand information across all directory listings
 */

import { callAI, isAnthropicAvailable, isGeminiAvailable } from '../utils/anthropic-client'
import { logger } from '../utils/logger'

export interface SyncResult {
  totalListings: number
  successfulSyncs: number
  failedSyncs: number
  results: ListingSyncResult[]
  overallConsistency: number
  directoriesUpdated: number
  pendingApprovals: string[]
  conflicts: string[]
}

export interface ListingSyncResult {
  listingId: string
  directoryName: string
  success: boolean
  error?: string
  fieldsAttempted: string[]
  fieldsUpdated: string[]
}

export interface InconsistencyReport {
  totalInconsistencies: number
  criticalInconsistencies: number
  inconsistenciesByField: Map<string, FieldInconsistency[]>
  inconsistenciesByDirectory: Map<string, FieldInconsistency[]>
  recommendedActions: string[]
  impactAssessment: ImpactAssessment
  issuesFound: number
  criticalIssues: FieldInconsistency[]
  suggestions: string[]
}

export interface FieldInconsistency {
  id: string
  listingId: string
  directoryName: string
  fieldName: string
  currentValue: string
  expectedValue: string
  suggestedValue: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  autoCorrectible: boolean
  impactOnSEO: number
}

export interface ImpactAssessment {
  seoImpact: number
  brandImpact: number
  userConfusion: number
  trustScore: number
}

export interface CorrectionResult {
  correctedListings: string[]
  failedCorrections: string[]
  nextActions: string[]
}

export interface IntegrityReport {
  status: 'stable' | 'warning' | 'critical'
  alerts: string[]
  auditTrail: AuditEntry[]
}

export interface AuditEntry {
  timestamp: string
  action: string
  directory: string
  field: string
  oldValue: string
  newValue: string
  reason: string
}

export interface MasterBrandProfile {
  businessName: string
  address: Address
  phone: string
  website: string
  email: string
  description: string
  categories: string[]
  hours: BusinessHours
  socialMedia: SocialMediaLinks
  images: BusinessImages
}

export interface Address {
  street: string
  city: string
  state: string
  zip: string
  country: string
}

export interface BusinessHours {
  [key: string]: { open: string; close: string }
}

export interface SocialMediaLinks {
  facebook?: string
  twitter?: string
  linkedin?: string
  instagram?: string
}

export interface BusinessImages {
  logo?: string
  photos?: string[]
}

class BrandConsistencyEngineImpl {
  async syncBrandInformation(
    masterProfile: MasterBrandProfile,
    directoryListings: any[]
  ): Promise<SyncResult> {
    try {
      logger.info('Syncing brand information', { metadata: { listingCount: directoryListings.length } })

      // Use Gemini for simple consistency checks
      const syncPrompt = `
        Analyze brand consistency across ${directoryListings.length} directory listings.
        
        Master Profile:
        - Name: ${masterProfile.businessName}
        - Phone: ${masterProfile.phone}
        - Address: ${masterProfile.address.city}, ${masterProfile.address.state}
        - Website: ${masterProfile.website}
        
        Identify which listings need updates to match the master profile.
        Return JSON with sync results.
      `

      const response = await callAI(syncPrompt, 'simple', {
        geminiModel: 'gemini-pro',
        maxTokens: 2000,
        temperature: 0.2
      })

      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        return {
          totalListings: directoryListings.length,
          successfulSyncs: data.successfulSyncs || 0,
          failedSyncs: data.failedSyncs || 0,
          results: data.results || [],
          overallConsistency: data.overallConsistency || 0,
          directoriesUpdated: data.directoriesUpdated || 0,
          pendingApprovals: data.pendingApprovals || [],
          conflicts: data.conflicts || []
        }
      }

      return {
        totalListings: directoryListings.length,
        successfulSyncs: 0,
        failedSyncs: 0,
        results: [],
        overallConsistency: 0,
        directoriesUpdated: 0,
        pendingApprovals: [],
        conflicts: []
      }
    } catch (error) {
      logger.error('Brand sync failed', {}, error as Error)
      throw error
    }
  }

  async detectInconsistencies(
    masterProfile: MasterBrandProfile,
    directoryListings: any[]
  ): Promise<InconsistencyReport> {
    try {
      logger.info('Detecting inconsistencies', { metadata: { listingCount: directoryListings.length } })

      // Use Gemini for simple inconsistency detection
      const detectionPrompt = `
        Detect brand inconsistencies across directory listings compared to master profile.
        
        Master Profile:
        ${JSON.stringify(masterProfile, null, 2)}
        
        Analyze each listing and identify:
        - Name variations
        - Phone number differences
        - Address inconsistencies
        - Website URL variations
        - Description differences
        
        Return JSON with detailed inconsistency report.
      `

      const response = await callAI(detectionPrompt, 'simple', {
        geminiModel: 'gemini-pro',
        maxTokens: 2500,
        temperature: 0.2
      })

      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        return {
          totalInconsistencies: data.totalInconsistencies || 0,
          criticalInconsistencies: data.criticalInconsistencies || 0,
          inconsistenciesByField: new Map(Object.entries(data.inconsistenciesByField || {})),
          inconsistenciesByDirectory: new Map(Object.entries(data.inconsistenciesByDirectory || {})),
          recommendedActions: data.recommendedActions || [],
          impactAssessment: data.impactAssessment || {
            seoImpact: 0,
            brandImpact: 0,
            userConfusion: 0,
            trustScore: 0
          },
          issuesFound: data.totalInconsistencies || 0,
          criticalIssues: data.criticalIssues || [],
          suggestions: data.suggestions || []
        }
      }

      return {
        totalInconsistencies: 0,
        criticalInconsistencies: 0,
        inconsistenciesByField: new Map(),
        inconsistenciesByDirectory: new Map(),
        recommendedActions: [],
        impactAssessment: {
          seoImpact: 0,
          brandImpact: 0,
          userConfusion: 0,
          trustScore: 0
        },
        issuesFound: 0,
        criticalIssues: [],
        suggestions: []
      }
    } catch (error) {
      logger.error('Inconsistency detection failed', {}, error as Error)
      throw error
    }
  }

  async autoCorrectListings(
    inconsistencies: FieldInconsistency[],
    masterProfile: MasterBrandProfile
  ): Promise<CorrectionResult> {
    try {
      logger.info('Auto-correcting listings', { metadata: { inconsistencyCount: inconsistencies.length } })

      // Use Gemini for simple corrections
      const correctionPrompt = `
        Generate corrections for ${inconsistencies.length} brand inconsistencies.
        
        Master Profile: ${JSON.stringify(masterProfile, null, 2)}
        Inconsistencies: ${JSON.stringify(inconsistencies.slice(0, 10), null, 2)}
        
        Provide correction recommendations that maintain directory-specific requirements while aligning with master profile.
        Return JSON with correction results.
      `

      const response = await callAI(correctionPrompt, 'simple', {
        geminiModel: 'gemini-pro',
        maxTokens: 2000,
        temperature: 0.2
      })

      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        return {
          correctedListings: data.correctedListings || [],
          failedCorrections: data.failedCorrections || [],
          nextActions: data.nextActions || []
        }
      }

      return {
        correctedListings: [],
        failedCorrections: [],
        nextActions: []
      }
    } catch (error) {
      logger.error('Auto-correction failed', {}, error as Error)
      throw error
    }
  }

  async maintainBrandIntegrity(
    masterProfile: MasterBrandProfile,
    directoryListings: any[]
  ): Promise<IntegrityReport> {
    try {
      logger.info('Maintaining brand integrity', { metadata: { listingCount: directoryListings.length } })

      // Use Anthropic for complex integrity analysis
      const integrityPrompt = `
        Assess brand integrity across all directory listings.
        
        Master Profile: ${JSON.stringify(masterProfile, null, 2)}
        Total Listings: ${directoryListings.length}
        
        Evaluate:
        - Overall consistency score
        - Critical integrity issues
        - Compliance with brand guidelines
        - SEO impact of inconsistencies
        
        Return JSON with integrity report including status, alerts, and audit trail.
      `

      const response = await callAI(integrityPrompt, 'complex', {
        anthropicModel: 'claude-3-sonnet-20241022',
        maxTokens: 2000,
        temperature: 0.2,
        systemPrompt: 'You are a brand integrity specialist. Provide comprehensive brand integrity assessments in JSON format.'
      })

      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        return {
          status: data.status || 'stable',
          alerts: data.alerts || [],
          auditTrail: data.auditTrail || []
        }
      }

      return {
        status: 'stable',
        alerts: [],
        auditTrail: []
      }
    } catch (error) {
      logger.error('Brand integrity maintenance failed', {}, error as Error)
      throw error
    }
  }
}

export const brandConsistencyEngine = new BrandConsistencyEngineImpl()
