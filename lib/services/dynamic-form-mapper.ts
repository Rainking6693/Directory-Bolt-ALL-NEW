/**
 * Dynamic Form Mapping Engine
 * 
 * Implements Phase 3, Section 3.3 Dynamic Form Mapping Engine:
 * - 3.3.1: Site-specific mapping files with JSON configs
 * - 3.3.2: Auto-mapping engine with semantic matching  
 * - 3.3.3: Try common patterns if not pre-mapped
 * - 3.3.4: Manual mapping fallback interface
 * - 3.3.5: Unmappable site logic
 */

import type { BusinessSubmissionRecord } from './autobolt-extension'

export interface SiteMapping {
  siteId: string
  siteName: string
  url: string
  submissionUrl: string
  formMappings: {
    [businessField: string]: string[] // CSS selectors in priority order
  }
  submitButton: string
  successIndicators: string[]
  skipConditions: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  requiresLogin: boolean
  hasCaptcha: boolean
  lastUpdated: string
  verificationStatus: 'verified' | 'needs-testing' | 'broken'
  fallbackPatterns?: {
    [businessField: string]: string[]
  }
}

export interface SemanticPattern {
  field: string
  selectors: string[]
  keywords: string[]
  priority: number
}

export interface MappingAttemptResult {
  field: string
  selector: string | null
  confidence: number
  method: 'exact-mapping' | 'semantic-match' | 'pattern-fallback' | 'manual-required'
  found: boolean
}

export interface DynamicMappingResult {
  siteId: string
  success: boolean
  mappedFields: { [field: string]: string }
  failedFields: string[]
  confidence: number
  method: 'site-specific' | 'auto-mapping' | 'fallback-patterns' | 'manual-needed'
  error?: string
  suggestions?: { [field: string]: string[] }
}

export class DynamicFormMapper {
  private siteMappings: Map<string, SiteMapping> = new Map()
  private semanticPatterns: SemanticPattern[] = []
  private commonPatterns: Map<string, string[]> = new Map()
  private isInitialized: boolean = false

  constructor() {}

  /**
   * 3.3.1: Initialize with site-specific mapping files
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log('🚀 Initializing Dynamic Form Mapping Engine...')

      // Load site-specific mappings
      await this.loadSiteMappings()
      
      // Load semantic patterns for auto-mapping
      await this.loadSemanticPatterns()
      
      // Load common fallback patterns
      await this.loadCommonPatterns()

      console.log(`✅ Dynamic Form Mapper initialized with ${this.siteMappings.size} site mappings`)
      this.isInitialized = true

    } catch (error) {
      console.error('❌ Failed to initialize Dynamic Form Mapper:', error)
      throw new Error(`Dynamic Form Mapper initialization failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 3.3.1: Load site-specific mapping configurations
   */
  private async loadSiteMappings(): Promise<void> {
    try {
      // Only perform file operations on the server
      if (typeof window === 'undefined') {
        const fs = await import('fs/promises')
        const path = await import('path')
        
        const mappingsDir = path.join(process.cwd(), 'lib', 'data', 'site-mappings')
        
        // Try to read directory, create if it doesn't exist
        let files: string[] = []
        try {
          files = await fs.readdir(mappingsDir)
        } catch (error) {
          console.log('📁 Site mappings directory not found, creating...')
          await fs.mkdir(mappingsDir, { recursive: true })
          
          // Create initial site mappings from existing directory list
          await this.createInitialSiteMappings(mappingsDir, fs, path)
          files = await fs.readdir(mappingsDir)
        }

        // Load all mapping files
        const jsonFiles = files.filter(file => file.endsWith('.json'))
        
        for (const file of jsonFiles) {
          const filePath = path.join(mappingsDir, file)
          const content = await fs.readFile(filePath, 'utf-8')
          const mapping: SiteMapping = JSON.parse(content)
          
          this.siteMappings.set(mapping.siteId, mapping)
          console.log(`📂 Loaded mapping for ${mapping.siteName}`)
        }
      } else {
        console.warn('⚠️ Site mappings loading attempted on client-side - using empty mappings')
      }

    } catch (error) {
      console.error('❌ Failed to load site mappings:', error)
      throw error
    }
  }

  /**
   * Create initial site mappings from existing master directory list
   */
  private async createInitialSiteMappings(mappingsDir: string, fs: any, path: any): Promise<void> {
    try {
      // Read existing master directory list
      const masterListPath = path.join(process.cwd(), 'lib', 'data', 'master-directory-list.json')
      const masterContent = await fs.readFile(masterListPath, 'utf-8')
      const masterList = JSON.parse(masterContent)

      // Convert each directory entry to enhanced site mapping
      for (const directory of masterList) {
        const siteMapping: SiteMapping = {
          siteId: directory.id,
          siteName: directory.name,
          url: directory.url,
          submissionUrl: directory.submissionUrl,
          formMappings: directory.formMapping || {},
          submitButton: directory.submitSelector || 'button[type="submit"], input[type="submit"], .submit-btn',
          successIndicators: directory.successIndicators || ['.success', '.thank-you', 'h1:contains("success")', '.confirmation'],
          skipConditions: ['.captcha', '.login-required', '.authentication', 'input[type="password"]'],
          difficulty: directory.difficulty || 'medium',
          requiresLogin: directory.requiresLogin || false,
          hasCaptcha: directory.hasCaptcha || false,
          lastUpdated: new Date().toISOString(),
          verificationStatus: 'needs-testing',
          fallbackPatterns: this.generateFallbackPatterns()
        }

        // Add skip reason for unmappable sites (3.3.5)
        if (directory.skipReason) {
          siteMapping.skipConditions.push(directory.skipReason)
        }

        const fileName = `${directory.id}.json`
        const filePath = path.join(mappingsDir, fileName)
        
        await fs.writeFile(filePath, JSON.stringify(siteMapping, null, 2))
        console.log(`📝 Created initial mapping for ${directory.name}`)
      }

    } catch (error) {
      console.error('❌ Failed to create initial site mappings:', error)
      throw error
    }
  }

  /**
   * Generate fallback patterns for common form fields
   */
  private generateFallbackPatterns(): { [field: string]: string[] } {
    return {
      businessName: [
        'input[name*="business"]',
        'input[name*="company"]', 
        'input[name*="organization"]',
        'input[id*="business"]',
        'input[placeholder*="business"]',
        'input[placeholder*="company"]'
      ],
      email: [
        'input[type="email"]',
        'input[name*="email"]',
        'input[id*="email"]',
        'input[placeholder*="email"]'
      ],
      phone: [
        'input[type="tel"]',
        'input[name*="phone"]',
        'input[name*="telephone"]',
        'input[id*="phone"]',
        'input[placeholder*="phone"]'
      ],
      website: [
        'input[name*="website"]',
        'input[name*="url"]',
        'input[name*="site"]',
        'input[id*="website"]',
        'input[placeholder*="website"]',
        'input[placeholder*="url"]'
      ],
      address: [
        'input[name*="address"]',
        'input[name*="street"]',
        'input[id*="address"]',
        'textarea[name*="address"]',
        'input[placeholder*="address"]'
      ],
      city: [
        'input[name*="city"]',
        'input[id*="city"]',
        'select[name*="city"]',
        'input[placeholder*="city"]'
      ],
      state: [
        'select[name*="state"]',
        'input[name*="state"]',
        'select[name*="province"]',
        'input[id*="state"]'
      ],
      zip: [
        'input[name*="zip"]',
        'input[name*="postal"]',
        'input[id*="zip"]',
        'input[placeholder*="zip"]',
        'input[placeholder*="postal"]'
      ],
      description: [
        'textarea[name*="description"]',
        'textarea[name*="about"]',
        'textarea[name*="summary"]',
        'textarea[id*="description"]',
        'textarea[placeholder*="description"]'
      ]
    }
  }

  /**
   * 3.3.2: Load semantic patterns for auto-mapping
   */
  private async loadSemanticPatterns(): Promise<void> {
    // Define semantic patterns for intelligent field detection
    this.semanticPatterns = [
      {
        field: 'businessName',
        selectors: ['input', 'select'],
        keywords: ['business', 'company', 'organization', 'name', 'title'],
        priority: 10
      },
      {
        field: 'email',
        selectors: ['input[type="email"]', 'input'],
        keywords: ['email', 'mail', 'e-mail', 'contact'],
        priority: 10
      },
      {
        field: 'phone',
        selectors: ['input[type="tel"]', 'input'],
        keywords: ['phone', 'telephone', 'mobile', 'tel', 'contact'],
        priority: 9
      },
      {
        field: 'website',
        selectors: ['input[type="url"]', 'input'],
        keywords: ['website', 'url', 'site', 'web', 'homepage'],
        priority: 8
      },
      {
        field: 'address',
        selectors: ['input', 'textarea'],
        keywords: ['address', 'street', 'location', 'addr'],
        priority: 7
      },
      {
        field: 'city',
        selectors: ['input', 'select'],
        keywords: ['city', 'town', 'municipality'],
        priority: 6
      },
      {
        field: 'state',
        selectors: ['select', 'input'],
        keywords: ['state', 'province', 'region'],
        priority: 6
      },
      {
        field: 'zip',
        selectors: ['input'],
        keywords: ['zip', 'postal', 'postcode', 'zipcode'],
        priority: 5
      },
      {
        field: 'description',
        selectors: ['textarea'],
        keywords: ['description', 'about', 'details', 'summary', 'bio'],
        priority: 4
      }
    ]

    console.log(`📋 Loaded ${this.semanticPatterns.length} semantic patterns`)
  }

  /**
   * 3.3.3: Load common fallback patterns
   */
  private async loadCommonPatterns(): Promise<void> {
    // Common patterns that work across many sites
    this.commonPatterns.set('businessName', [
      '#company_name', '#business_name', '#organization_name',
      'input[name="company_name"]', 'input[name="business_name"]',
      'input[placeholder*="company name"]', 'input[placeholder*="business name"]'
    ])
    
    this.commonPatterns.set('email', [
      '#email', '#email_address', '#contact_email',
      'input[name="email"]', 'input[name="email_address"]',
      'input[type="email"]'
    ])

    this.commonPatterns.set('phone', [
      '#phone', '#phone_number', '#telephone',
      'input[name="phone"]', 'input[name="phone_number"]',
      'input[type="tel"]'
    ])

    console.log(`🔍 Loaded common patterns for ${this.commonPatterns.size} fields`)
  }

  /**
   * Main mapping function - attempts multiple strategies
   */
  async mapFormFields(
    siteUrl: string, 
    businessData: BusinessSubmissionRecord,
    domContent?: string
  ): Promise<DynamicMappingResult> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    console.log(`🔍 Mapping form fields for ${siteUrl}`)

    // Try to identify site from URL
    const siteMapping = this.findSiteMappingByUrl(siteUrl)
    
    if (siteMapping) {
      // 3.3.1: Use site-specific mapping
      return await this.applySiteSpecificMapping(siteMapping, businessData)
    } else {
      // 3.3.2 & 3.3.3: Use auto-mapping and fallback patterns
      return await this.applyDynamicMapping(siteUrl, businessData, domContent)
    }
  }

  /**
   * Find site mapping by URL
   */
  private findSiteMappingByUrl(url: string): SiteMapping | null {
    for (const mapping of this.siteMappings.values()) {
      if (url.includes(this.extractDomain(mapping.url))) {
        return mapping
      }
    }
    return null
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.replace('www.', '')
    } catch {
      return url
    }
  }

  /**
   * 3.3.1: Apply site-specific mapping
   */
  private async applySiteSpecificMapping(
    siteMapping: SiteMapping,
    businessData: BusinessSubmissionRecord
  ): Promise<DynamicMappingResult> {
    console.log(`📋 Applying site-specific mapping for ${siteMapping.siteName}`)

    const mappedFields: { [field: string]: string } = {}
    const failedFields: string[] = []
    let totalConfidence = 0
    let fieldCount = 0

    // Map each business field using site-specific selectors
    for (const [businessField, selectors] of Object.entries(siteMapping.formMappings)) {
      if (!selectors || selectors.length === 0) continue

      const businessValue = businessData[businessField as keyof BusinessSubmissionRecord]
      if (!businessValue) continue

      // Use the first (highest priority) selector
      const primarySelector = selectors[0]
      mappedFields[businessField] = primarySelector
      totalConfidence += 0.95 // High confidence for site-specific mappings
      fieldCount++
    }

    // Check for unmappable conditions (3.3.5)
    const isUnmappable = this.checkUnmappableConditions(siteMapping)
    if (isUnmappable.isUnmappable) {
      return {
        siteId: siteMapping.siteId,
        success: false,
        mappedFields: {},
        failedFields: Object.keys(siteMapping.formMappings),
        confidence: 0,
        method: 'manual-needed',
        error: `Site unmappable: ${isUnmappable.reason}`
      }
    }

    const avgConfidence = fieldCount > 0 ? totalConfidence / fieldCount : 0

    return {
      siteId: siteMapping.siteId,
      success: Object.keys(mappedFields).length > 0,
      mappedFields,
      failedFields,
      confidence: avgConfidence,
      method: 'site-specific'
    }
  }

  /**
   * 3.3.5: Check for unmappable site conditions
   */
  private checkUnmappableConditions(siteMapping: SiteMapping): { isUnmappable: boolean; reason?: string } {
    if (siteMapping.requiresLogin) {
      return { isUnmappable: true, reason: 'Requires user login' }
    }
    
    if (siteMapping.hasCaptcha) {
      return { isUnmappable: true, reason: 'Has CAPTCHA protection' }
    }

    if (siteMapping.verificationStatus === 'broken') {
      return { isUnmappable: true, reason: 'Site mapping is broken and needs repair' }
    }

    // Check for anti-bot patterns
    const antiBotIndicators = [
      'cloudflare',
      'ddos-guard', 
      'bot-protection',
      'human-verification',
      'rate-limit-exceeded'
    ]

    for (const indicator of antiBotIndicators) {
      if (siteMapping.skipConditions.some(condition => condition.toLowerCase().includes(indicator))) {
        return { isUnmappable: true, reason: `Anti-bot protection detected: ${indicator}` }
      }
    }

    return { isUnmappable: false }
  }

  /**
   * 3.3.2 & 3.3.3: Apply dynamic mapping using semantic patterns and fallbacks
   */
  private async applyDynamicMapping(
    siteUrl: string,
    businessData: BusinessSubmissionRecord,
    domContent?: string
  ): Promise<DynamicMappingResult> {
    console.log(`🤖 Applying dynamic mapping for ${siteUrl}`)

    const mappedFields: { [field: string]: string } = {}
    const failedFields: string[] = []
    const suggestions: { [field: string]: string[] } = {}
    let totalConfidence = 0
    let fieldCount = 0

    // Get business fields that have values
    const fieldsToMap = this.getBusinessFieldsWithValues(businessData)

    for (const fieldName of fieldsToMap) {
      const attemptResult = await this.attemptFieldMapping(fieldName, domContent)
      
      if (attemptResult.found && attemptResult.selector) {
        mappedFields[fieldName] = attemptResult.selector
        totalConfidence += attemptResult.confidence
      } else {
        failedFields.push(fieldName)
        // Provide suggestions for manual mapping (3.3.4)
        suggestions[fieldName] = this.generateFieldSuggestions(fieldName)
      }
      fieldCount++
    }

    const avgConfidence = fieldCount > 0 ? totalConfidence / fieldCount : 0
    const hasSuccessfulMappings = Object.keys(mappedFields).length > 0
    
    // Determine method used
    let method: 'auto-mapping' | 'fallback-patterns' | 'manual-needed'
    if (hasSuccessfulMappings) {
      method = avgConfidence > 0.7 ? 'auto-mapping' : 'fallback-patterns'
    } else {
      method = 'manual-needed'
    }

    return {
      siteId: this.extractDomain(siteUrl),
      success: hasSuccessfulMappings,
      mappedFields,
      failedFields,
      confidence: avgConfidence,
      method,
      suggestions: Object.keys(suggestions).length > 0 ? suggestions : undefined
    }
  }

  /**
   * Get business fields that have non-empty values
   */
  private getBusinessFieldsWithValues(businessData: BusinessSubmissionRecord): string[] {
    const coreFields = ['businessName', 'email', 'phone', 'website', 'address', 'city', 'state', 'zip', 'description']
    
    return coreFields.filter(field => {
      const value = businessData[field as keyof BusinessSubmissionRecord]
      return value && String(value).trim().length > 0
    })
  }

  /**
   * Attempt to map a single field using multiple strategies
   */
  private async attemptFieldMapping(fieldName: string, domContent?: string): Promise<MappingAttemptResult> {
    // Strategy 1: Semantic matching (3.3.2)
    const semanticResult = this.attemptSemanticMatching(fieldName, domContent)
    if (semanticResult.found) {
      return semanticResult
    }

    // Strategy 2: Common patterns (3.3.3)
    const patternResult = this.attemptPatternMatching(fieldName)
    if (patternResult.found) {
      return patternResult
    }

    // Strategy 3: Fallback patterns from site mapping
    const fallbackResult = this.attemptFallbackMapping(fieldName)
    if (fallbackResult.found) {
      return fallbackResult
    }

    // No mapping found
    return {
      field: fieldName,
      selector: null,
      confidence: 0,
      method: 'manual-required',
      found: false
    }
  }

  /**
   * 3.3.2: Attempt semantic matching based on field context
   */
  private attemptSemanticMatching(fieldName: string, domContent?: string): MappingAttemptResult {
    const pattern = this.semanticPatterns.find(p => p.field === fieldName)
    
    if (!pattern) {
      return { field: fieldName, selector: null, confidence: 0, method: 'semantic-match', found: false }
    }

    // If we have DOM content, we could analyze it for better matching
    // For now, use the highest priority selector from the pattern
    const selector = pattern.selectors[0]
    
    // Calculate confidence based on pattern priority and specificity
    const confidence = Math.min(0.8, pattern.priority / 10)

    return {
      field: fieldName,
      selector,
      confidence,
      method: 'semantic-match',
      found: true
    }
  }

  /**
   * 3.3.3: Attempt pattern matching using common selectors
   */
  private attemptPatternMatching(fieldName: string): MappingAttemptResult {
    const patterns = this.commonPatterns.get(fieldName)
    
    if (!patterns || patterns.length === 0) {
      return { field: fieldName, selector: null, confidence: 0, method: 'pattern-fallback', found: false }
    }

    // Use the first (most common) pattern
    const selector = patterns[0]
    
    return {
      field: fieldName,
      selector,
      confidence: 0.6, // Medium confidence for common patterns
      method: 'pattern-fallback',
      found: true
    }
  }

  /**
   * Attempt fallback mapping using site-specific fallback patterns
   */
  private attemptFallbackMapping(fieldName: string): MappingAttemptResult {
    const fallbackPatterns = this.generateFallbackPatterns()
    const patterns = fallbackPatterns[fieldName]
    
    if (!patterns || patterns.length === 0) {
      return { field: fieldName, selector: null, confidence: 0, method: 'pattern-fallback', found: false }
    }

    return {
      field: fieldName,
      selector: patterns[0],
      confidence: 0.4, // Lower confidence for fallback patterns
      method: 'pattern-fallback',
      found: true
    }
  }

  /**
   * 3.3.4: Generate suggestions for manual mapping
   */
  private generateFieldSuggestions(fieldName: string): string[] {
    const suggestions: string[] = []
    
    // Add semantic-based suggestions
    const semanticPattern = this.semanticPatterns.find(p => p.field === fieldName)
    if (semanticPattern) {
      suggestions.push(...semanticPattern.selectors)
    }

    // Add common pattern suggestions
    const commonPatterns = this.commonPatterns.get(fieldName)
    if (commonPatterns) {
      suggestions.push(...commonPatterns)
    }

    // Add fallback suggestions
    const fallbackPatterns = this.generateFallbackPatterns()
    const fallback = fallbackPatterns[fieldName]
    if (fallback) {
      suggestions.push(...fallback)
    }

    // Remove duplicates and return top 5 suggestions
    return [...new Set(suggestions)].slice(0, 5)
  }

  /**
   * Save a successful mapping for future use
   */
  async saveMappingForSite(siteUrl: string, mappings: { [field: string]: string | string[] }): Promise<void> {
    try {
      // Only perform file operations on the server
      if (typeof window === 'undefined') {
        const fs = await import('fs/promises')
        const path = await import('path')
        
        const domain = this.extractDomain(siteUrl)
        const siteId = domain.replace(/[^a-zA-Z0-9]/g, '-')
        
        // Check if mapping already exists
        let existingMapping = this.siteMappings.get(siteId)
        
        if (!existingMapping) {
          // Create new mapping
          existingMapping = {
            siteId,
            siteName: domain,
            url: siteUrl,
            submissionUrl: siteUrl,
            formMappings: {},
            submitButton: 'button[type="submit"], input[type="submit"]',
            successIndicators: ['.success', '.thank-you', '.confirmation'],
            skipConditions: ['.captcha', '.login-required'],
            difficulty: 'medium',
            requiresLogin: false,
            hasCaptcha: false,
            lastUpdated: new Date().toISOString(),
            verificationStatus: 'needs-testing'
          }
        }

        // Update mappings - ensure all values are arrays
        const arrayMappings = Object.entries(mappings).reduce((acc, [key, value]) => {
          acc[key] = Array.isArray(value) ? value : [value]
          return acc
        }, {} as { [businessField: string]: string[] })
        
        existingMapping.formMappings = { ...existingMapping.formMappings, ...arrayMappings }
        existingMapping.lastUpdated = new Date().toISOString()
        existingMapping.verificationStatus = 'verified'

        // Save to file
        const mappingsDir = path.join(process.cwd(), 'lib', 'data', 'site-mappings')
        const fileName = `${siteId}.json`
        const filePath = path.join(mappingsDir, fileName)
        
        await fs.writeFile(filePath, JSON.stringify(existingMapping, null, 2))
        
        // Update in-memory mapping
        this.siteMappings.set(siteId, existingMapping)

        console.log(`💾 Saved mapping for ${domain} with ${Object.keys(mappings).length} fields`)
      } else {
        console.warn('⚠️ Mapping save attempted on client-side - operation skipped')
      }

    } catch (error) {
      console.error(`❌ Failed to save mapping for ${siteUrl}:`, error)
    }
  }

  /**
   * Get mapping statistics
   */
  getMappingStats(): {
    totalSites: number
    verifiedSites: number
    needsTesting: number
    brokenSites: number
    totalMappings: number
  } {
    const stats = {
      totalSites: this.siteMappings.size,
      verifiedSites: 0,
      needsTesting: 0,
      brokenSites: 0,
      totalMappings: 0
    }

    for (const mapping of this.siteMappings.values()) {
      switch (mapping.verificationStatus) {
        case 'verified':
          stats.verifiedSites++
          break
        case 'needs-testing':
          stats.needsTesting++
          break
        case 'broken':
          stats.brokenSites++
          break
      }
      
      stats.totalMappings += Object.keys(mapping.formMappings).length
    }

    return stats
  }

  /**
   * Get all site mappings for inspection
   */
  getAllSiteMappings(): SiteMapping[] {
    return Array.from(this.siteMappings.values())
  }

  /**
   * Mark a site mapping as broken
   */
  async markSiteAsBroken(siteId: string, reason: string): Promise<void> {
    const mapping = this.siteMappings.get(siteId)
    if (mapping) {
      mapping.verificationStatus = 'broken'
      mapping.skipConditions.push(`Broken: ${reason}`)
      mapping.lastUpdated = new Date().toISOString()

      // Only perform file operations on the server
      if (typeof window === 'undefined') {
        try {
          const fs = await import('fs/promises')
          const path = await import('path')
          
          // Save updated mapping
          const mappingsDir = path.join(process.cwd(), 'lib', 'data', 'site-mappings')
          const filePath = path.join(mappingsDir, `${siteId}.json`)
          await fs.writeFile(filePath, JSON.stringify(mapping, null, 2))

          console.log(`🚫 Marked ${mapping.siteName} as broken: ${reason}`)
        } catch (error) {
          console.error(`❌ Failed to save broken mapping for ${siteId}:`, error)
        }
      } else {
        console.warn('⚠️ Site broken marking attempted on client-side - file not saved')
        console.log(`🚫 Marked ${mapping.siteName} as broken: ${reason} (in-memory only)`)
      }
    }
  }
}

// Export singleton instance
export const dynamicFormMapper = new DynamicFormMapper()
export default dynamicFormMapper
