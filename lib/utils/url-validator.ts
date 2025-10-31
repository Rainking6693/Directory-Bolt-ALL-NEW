// 🔒 ENHANCED URL VALIDATION - Comprehensive URL validation with detailed error reporting
// Advanced URL validation, security checks, and accessibility testing

import { ValidationError, Errors } from './errors'
import { logger } from './logger'

export interface URLValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: string[]
  sanitizedUrl?: string
  metadata: {
    protocol: string
    hostname: string
    domain: string
    subdomain?: string
    port?: number
    path: string
    isSecure: boolean
    isPubliclyAccessible: boolean
    estimatedResponseTime?: number
  }
  securityChecks: {
    isSuspiciousDomain: boolean
    isInternalNetwork: boolean
    isKnownMalware: boolean
    hasValidCertificate?: boolean
    supportsHttps?: boolean
  }
  accessibility: {
    isReachable: boolean
    httpStatus?: number
    responseTime?: number
    redirectChain?: string[]
    finalUrl?: string
    error?: string
  }
}

export class URLValidator {
  private suspiciousDomains: Set<string>
  private internalNetworkRanges: RegExp[]
  private malwareDomainsCache: Map<string, boolean>
  private cache: Map<string, URLValidationResult>
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  constructor() {
    this.suspiciousDomains = new Set([
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '10.',
      '192.168.',
      '172.16.',
      '172.17.',
      '172.18.',
      '172.19.',
      '172.20.',
      '172.21.',
      '172.22.',
      '172.23.',
      '172.24.',
      '172.25.',
      '172.26.',
      '172.27.',
      '172.28.',
      '172.29.',
      '172.30.',
      '172.31.',
    ])

    this.internalNetworkRanges = [
      /^127\./,           // Loopback
      /^10\./,            // Private Class A
      /^192\.168\./,      // Private Class C
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // Private Class B
      /^169\.254\./,      // Link-local
      /^fe80:/i,          // IPv6 link-local
      /^::1$/,            // IPv6 loopback
    ]

    this.malwareDomainsCache = new Map()
    this.cache = new Map()
  }

  async validateUrl(url: string): Promise<URLValidationResult> {
    // Check cache first
    const cached = this.cache.get(url)
    if (cached && Date.now() - cached.metadata.estimatedResponseTime! < this.CACHE_TTL) {
      return cached
    }

    const result: URLValidationResult = {
      isValid: false,
      errors: [],
      warnings: [],
      metadata: {
        protocol: '',
        hostname: '',
        domain: '',
        path: '',
        isSecure: false,
        isPubliclyAccessible: false
      },
      securityChecks: {
        isSuspiciousDomain: false,
        isInternalNetwork: false,
        isKnownMalware: false
      },
      accessibility: {
        isReachable: false
      }
    }

    try {
      // Basic validation
      if (!url || typeof url !== 'string') {
        result.errors.push(Errors.required('URL'))
        return result
      }

      let sanitizedUrl = url.trim()

      // Add protocol if missing
      if (!/^https?:\/\//i.test(sanitizedUrl)) {
        sanitizedUrl = 'https://' + sanitizedUrl
      }

      // URL format validation
      let urlObj: URL
      try {
        urlObj = new URL(sanitizedUrl)
      } catch (error) {
        result.errors.push(Errors.invalid('URL', 'Invalid URL format'))
        return result
      }

      // Extract metadata
      result.metadata = {
        protocol: urlObj.protocol.replace(':', ''),
        hostname: urlObj.hostname,
        domain: this.extractDomain(urlObj.hostname),
        subdomain: this.extractSubdomain(urlObj.hostname),
        port: urlObj.port ? parseInt(urlObj.port) : undefined,
        path: urlObj.pathname,
        isSecure: urlObj.protocol === 'https:',
        isPubliclyAccessible: false, // Will be determined later
        estimatedResponseTime: Date.now()
      }

      result.sanitizedUrl = sanitizedUrl

      // Protocol validation
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        result.errors.push(Errors.invalid('URL', `Unsupported protocol: ${urlObj.protocol}`))
        return result
      }

      // Hostname validation
      if (!urlObj.hostname) {
        result.errors.push(Errors.invalid('URL', 'Missing hostname'))
        return result
      }

      // Domain length validation
      if (urlObj.hostname.length > 253) {
        result.errors.push(Errors.invalid('URL', 'Domain name too long'))
        return result
      }

      // Security checks
      result.securityChecks = await this.performSecurityChecks(urlObj)

      // Block internal/suspicious URLs
      if (result.securityChecks.isInternalNetwork) {
        result.errors.push(new ValidationError(
          'Internal network addresses are not allowed for security reasons',
          'url',
          'INTERNAL_NETWORK'
        ))
        return result
      }

      if (result.securityChecks.isSuspiciousDomain) {
        result.errors.push(new ValidationError(
          'This domain appears to be suspicious or potentially malicious',
          'url',
          'SUSPICIOUS_DOMAIN'
        ))
        return result
      }

      if (result.securityChecks.isKnownMalware) {
        result.errors.push(new ValidationError(
          'This domain is flagged as containing malware or being malicious',
          'url',
          'MALWARE_DOMAIN'
        ))
        return result
      }

      // Accessibility checks
      result.accessibility = await this.performAccessibilityChecks(sanitizedUrl)

      if (!result.accessibility.isReachable) {
        result.errors.push(new ValidationError(
          `Website is not accessible: ${result.accessibility.error || 'Unknown error'}`,
          'url',
          'NOT_ACCESSIBLE'
        ))
        return result
      }

      // HTTP status validation
      if (result.accessibility.httpStatus && result.accessibility.httpStatus >= 400) {
        if (result.accessibility.httpStatus === 403) {
          result.errors.push(new ValidationError(
            'Website blocks automated access (403 Forbidden)',
            'url',
            'ACCESS_FORBIDDEN'
          ))
        } else if (result.accessibility.httpStatus === 404) {
          result.errors.push(new ValidationError(
            'Website not found (404)',
            'url',
            'NOT_FOUND'
          ))
        } else if (result.accessibility.httpStatus >= 500) {
          result.errors.push(new ValidationError(
            `Website server error (${result.accessibility.httpStatus})`,
            'url',
            'SERVER_ERROR'
          ))
        } else {
          result.errors.push(new ValidationError(
            `Website returned error status: ${result.accessibility.httpStatus}`,
            'url',
            'HTTP_ERROR'
          ))
        }
        return result
      }

      // Performance warnings
      if (result.accessibility.responseTime && result.accessibility.responseTime > 10000) {
        result.warnings.push('Website response time is very slow (>10s)')
      } else if (result.accessibility.responseTime && result.accessibility.responseTime > 5000) {
        result.warnings.push('Website response time is slow (>5s)')
      }

      // Security warnings
      if (!result.metadata.isSecure) {
        result.warnings.push('Website does not use HTTPS encryption')
      }

      if (result.accessibility.redirectChain && result.accessibility.redirectChain.length > 3) {
        result.warnings.push(`Excessive redirects detected (${result.accessibility.redirectChain.length})`)
      }

      // Update final metadata
      result.metadata.isPubliclyAccessible = result.accessibility.isReachable
      result.isValid = result.errors.length === 0

      // Cache successful validations
      if (result.isValid || result.errors.every(e => (e as any).errorCode !== 'INTERNAL_NETWORK')) {
        this.cache.set(url, result)
      }

      logger.info('URL validation completed', {
        metadata: {
          url: sanitizedUrl,
          isValid: result.isValid,
          errorCount: result.errors.length,
          warningCount: result.warnings.length,
          responseTime: result.accessibility.responseTime,
          httpStatus: result.accessibility.httpStatus
        }
      })

      return result

    } catch (error) {
      result.errors.push(new ValidationError(
        `URL validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'url',
        'VALIDATION_FAILED'
      ))

      logger.error('URL validation error', {
        metadata: { url, error: error instanceof Error ? error.message : 'Unknown error' }
      }, error instanceof Error ? error : new Error(String(error)))

      return result
    }
  }

  private async performSecurityChecks(urlObj: URL): Promise<URLValidationResult['securityChecks']> {
    const checks = {
      isSuspiciousDomain: false,
      isInternalNetwork: false,
      isKnownMalware: false,
      hasValidCertificate: undefined as boolean | undefined,
      supportsHttps: undefined as boolean | undefined
    }

    // Check for suspicious domains
    const hostname = urlObj.hostname.toLowerCase()
    checks.isSuspiciousDomain = Array.from(this.suspiciousDomains).some(domain =>
      hostname.includes(domain)
    )

    // Check for internal network ranges
    checks.isInternalNetwork = this.internalNetworkRanges.some(range =>
      range.test(hostname)
    )

    // Check for known malware domains (with caching)
    checks.isKnownMalware = await this.checkMalwareDomain(hostname)

    // HTTPS support check
    if (urlObj.protocol === 'http:') {
      try {
        const httpsUrl = urlObj.toString().replace('http:', 'https:')
        const httpsCheck = await this.quickHttpsCheck(httpsUrl)
        checks.supportsHttps = httpsCheck.success
        if (httpsCheck.success) {
          checks.hasValidCertificate = true
        }
      } catch (error) {
        checks.supportsHttps = false
      }
    } else {
      checks.supportsHttps = true
      // Certificate validation would go here
    }

    return checks
  }

  private async performAccessibilityChecks(url: string): Promise<URLValidationResult['accessibility']> {
    const accessibility: URLValidationResult['accessibility'] = {
      isReachable: false
    }

    try {
      const startTime = Date.now()
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'DirectoryBolt/1.0 (+https://directorybolt.com)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        redirect: 'follow'
      })

      clearTimeout(timeoutId)

      accessibility.httpStatus = response.status
      accessibility.responseTime = Date.now() - startTime
      accessibility.isReachable = response.status >= 200 && response.status < 400
      accessibility.finalUrl = response.url

      // Track redirect chain
      if (response.url !== url) {
        accessibility.redirectChain = [url, response.url]
        // In a real implementation, you'd track the full redirect chain
      }

    } catch (error) {
      accessibility.isReachable = false
      accessibility.error = error instanceof Error ? error.message : 'Unknown error'

      // Handle specific error types
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          accessibility.error = 'Request timed out (15s limit)'
        } else if (error.message.includes('ENOTFOUND')) {
          accessibility.error = 'Domain does not exist'
        } else if (error.message.includes('ECONNREFUSED')) {
          accessibility.error = 'Connection refused'
        } else if (error.message.includes('ECONNRESET')) {
          accessibility.error = 'Connection reset'
        } else if (error.message.includes('certificate')) {
          accessibility.error = 'SSL certificate error'
        }
      }
    }

    return accessibility
  }

  private async checkMalwareDomain(hostname: string): Promise<boolean> {
    // Check cache first
    const cached = this.malwareDomainsCache.get(hostname)
    if (cached !== undefined) {
      return cached
    }

    // In a real implementation, you'd check against threat intelligence APIs
    // For now, return false with some basic heuristics
    const isMalware = hostname.includes('malware') || 
                     hostname.includes('phishing') ||
                     hostname.includes('scam') ||
                     /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(hostname) // Raw IP addresses

    // Cache the result for 1 hour
    this.malwareDomainsCache.set(hostname, isMalware)
    setTimeout(() => {
      this.malwareDomainsCache.delete(hostname)
    }, 60 * 60 * 1000)

    return isMalware
  }

  private async quickHttpsCheck(httpsUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

      const response = await fetch(httpsUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: { 'User-Agent': 'DirectoryBolt/1.0' }
      })

      clearTimeout(timeoutId)
      return { success: response.status < 400 }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private extractDomain(hostname: string): string {
    const parts = hostname.split('.')
    if (parts.length >= 2) {
      return parts.slice(-2).join('.')
    }
    return hostname
  }

  private extractSubdomain(hostname: string): string | undefined {
    const parts = hostname.split('.')
    if (parts.length > 2) {
      return parts.slice(0, -2).join('.')
    }
    return undefined
  }

  // Clear cache periodically
  clearCache(): void {
    this.cache.clear()
    this.malwareDomainsCache.clear()
  }
}

// Global validator instance
export const urlValidator = new URLValidator()

// Helper function for backward compatibility
export async function validateUrl(url: string): Promise<{
  isValid: boolean
  errors: string[]
  sanitizedUrl?: string
}> {
  const result = await urlValidator.validateUrl(url)
  return {
    isValid: result.isValid,
    errors: result.errors.map(e => e.message),
    sanitizedUrl: result.sanitizedUrl
  }
}

// Export enhanced validation function
export async function validateUrlEnhanced(url: string): Promise<URLValidationResult> {
  return urlValidator.validateUrl(url)
}

// Cleanup cache every hour
setInterval(() => {
  urlValidator.clearCache()
}, 60 * 60 * 1000)