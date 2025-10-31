// 🚀 OPTIMIZED WEBSITE SCRAPER - High-performance scraping with concurrency and caching
// Advanced scraping with parallel processing, intelligent caching, and performance optimization

import axios, { AxiosResponse, AxiosRequestConfig } from 'axios'
import * as cheerio from 'cheerio'
import { logger } from '../utils/logger'

export interface ScrapingConfig {
  maxConcurrency: number
  timeout: number
  maxRetries: number
  retryDelay: number
  userAgent: string
  respectRobots: boolean
  cacheTTL: number
  maxCacheSize: number
  rateLimit: {
    requestsPerSecond: number
    burstSize: number
  }
  headers: Record<string, string>
}

export interface ScrapingJob {
  id: string
  url: string
  options: {
    method?: 'GET' | 'POST' | 'HEAD'
    headers?: Record<string, string>
    timeout?: number
    followRedirects?: boolean
    maxRedirects?: number
    validateSSL?: boolean
    priority?: 'low' | 'normal' | 'high'
    cacheKey?: string
    skipCache?: boolean
  }
  metadata?: Record<string, any>
  retryCount?: number
  createdAt: number
  startedAt?: number
  completedAt?: number
}

export interface ScrapingResult {
  success: boolean
  url: string
  finalUrl?: string
  statusCode?: number
  headers?: Record<string, string>
  html?: string
  redirectChain?: string[]
  timing: {
    total: number
    dns?: number
    connect?: number
    ssl?: number
    download?: number
  }
  cache: {
    hit: boolean
    key?: string
    age?: number
  }
  metadata: {
    size: number
    encoding?: string
    contentType?: string
    lastModified?: string
    etag?: string
  }
  error?: {
    code: string
    message: string
    retryable: boolean
  }
}

export interface CacheEntry {
  key: string
  url: string
  result: ScrapingResult
  createdAt: number
  accessCount: number
  lastAccessed: number
  expiresAt: number
  size: number
  tags: string[]
}

export interface ScraperStats {
  total: {
    requests: number
    success: number
    errors: number
    cached: number
    bytes: number
  }
  timing: {
    average: number
    min: number
    max: number
    p95: number
  }
  cache: {
    hits: number
    misses: number
    hitRate: number
    size: number
    entries: number
  }
  errors: {
    [errorCode: string]: number
  }
  concurrent: {
    active: number
    queued: number
    completed: number
  }
}

// Default configuration optimized for different user tiers
const DEFAULT_CONFIG: ScrapingConfig = {
  maxConcurrency: 10,
  timeout: 20000, // Reduced from 30s to 20s for better UX
  maxRetries: 2, // Reduced retries for faster failure detection
  retryDelay: 1000,
  userAgent: 'DirectoryBolt/2.0 (+https://directorybolt.com)',
  respectRobots: true,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 100 * 1024 * 1024, // 100MB
  rateLimit: {
    requestsPerSecond: 10,
    burstSize: 20
  },
  headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none'
  }
}

export class OptimizedScraper {
  private config: ScrapingConfig
  private cache: Map<string, CacheEntry>
  private jobQueue: ScrapingJob[]
  private activeJobs: Map<string, ScrapingJob>
  private stats: ScraperStats
  private rateLimitTokens: number
  private lastTokenRefill: number
  private processing: boolean
  private processInterval: NodeJS.Timeout | null

  constructor(config: Partial<ScrapingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.cache = new Map()
    this.jobQueue = []
    this.activeJobs = new Map()
    this.rateLimitTokens = this.config.rateLimit.burstSize
    this.lastTokenRefill = Date.now()
    this.processing = false
    this.processInterval = null

    this.stats = {
      total: { requests: 0, success: 0, errors: 0, cached: 0, bytes: 0 },
      timing: { average: 0, min: Infinity, max: 0, p95: 0 },
      cache: { hits: 0, misses: 0, hitRate: 0, size: 0, entries: 0 },
      errors: {},
      concurrent: { active: 0, queued: 0, completed: 0 }
    }

    this.startProcessing()
  }

  async scrapeUrl(url: string, options: ScrapingJob['options'] = {}): Promise<ScrapingResult> {
    const job: ScrapingJob = {
      id: this.generateJobId(),
      url,
      options,
      createdAt: Date.now(),
      retryCount: 0
    }

    return new Promise((resolve, reject) => {
      // Add completion handlers to job
      (job as any).resolve = resolve;
      (job as any).reject = reject

      // Add to queue
      this.addJobToQueue(job)
    })
  }

  async scrapeMultiple(
    urls: string[], 
    options: ScrapingJob['options'] = {},
    batchOptions: {
      maxConcurrency?: number
      stopOnError?: boolean
      progressCallback?: (completed: number, total: number) => void
    } = {}
  ): Promise<ScrapingResult[]> {
    const results: (ScrapingResult | Error)[] = new Array(urls.length)
    const jobs: Promise<void>[] = []
    let completed = 0

    const semaphore = new Semaphore(batchOptions.maxConcurrency || this.config.maxConcurrency)

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]
      
      jobs.push(
        semaphore.acquire().then(async (release) => {
          try {
            results[i] = await this.scrapeUrl(url, options)
            completed++
            
            if (batchOptions.progressCallback) {
              batchOptions.progressCallback(completed, urls.length)
            }
          } catch (error) {
            results[i] = error instanceof Error ? error : new Error(String(error))
            
            if (batchOptions.stopOnError) {
              throw error
            }
            
            completed++
            if (batchOptions.progressCallback) {
              batchOptions.progressCallback(completed, urls.length)
            }
          } finally {
            release()
          }
        })
      )
    }

    try {
      await Promise.all(jobs)
    } catch (error) {
      if (batchOptions.stopOnError) {
        throw error
      }
    }

    return results.map(result => 
      result instanceof Error 
        ? { 
            success: false, 
            url: urls[results.indexOf(result)], 
            error: { code: 'BATCH_ERROR', message: result.message, retryable: false },
            timing: { total: 0 },
            cache: { hit: false },
            metadata: { size: 0 }
          } 
        : result
    ) as ScrapingResult[]
  }

  private addJobToQueue(job: ScrapingJob): void {
    // Prioritize jobs
    const priority = job.options.priority || 'normal'
    
    if (priority === 'high') {
      this.jobQueue.unshift(job)
    } else if (priority === 'low') {
      this.jobQueue.push(job)
    } else {
      // Insert in middle for normal priority
      const midpoint = Math.floor(this.jobQueue.length / 2)
      this.jobQueue.splice(midpoint, 0, job)
    }

    this.stats.concurrent.queued = this.jobQueue.length
  }

  private startProcessing(): void {
    if (this.processing) return

    this.processing = true
    this.processInterval = setInterval(() => {
      this.processJobs()
    }, 100) // Check every 100ms
  }

  private async processJobs(): Promise<void> {
    // Refill rate limit tokens
    this.refillTokens()

    // Process jobs while we have capacity and tokens
    while (
      this.jobQueue.length > 0 &&
      this.activeJobs.size < this.config.maxConcurrency &&
      this.rateLimitTokens > 0
    ) {
      const job = this.jobQueue.shift()!
      this.rateLimitTokens--
      
      this.activeJobs.set(job.id, job)
      this.stats.concurrent.active = this.activeJobs.size
      this.stats.concurrent.queued = this.jobQueue.length

      // Process job asynchronously
      this.processJob(job).catch(error => {
        logger.error('Job processing error', { metadata: { jobId: job.id, url: job.url } }, error)
      })
    }
  }

  private async processJob(job: ScrapingJob): Promise<void> {
    const startTime = Date.now()
    job.startedAt = startTime

    try {
      // Check cache first
      const cacheKey = job.options.cacheKey || this.generateCacheKey(job.url, job.options)
      let result: ScrapingResult | null = null

      if (!job.options.skipCache) {
        result = this.getFromCache(cacheKey)
        if (result) {
          this.stats.cache.hits++
          this.stats.total.cached++
          this.completeJob(job, result)
          return
        }
      }

      this.stats.cache.misses++

      // Perform actual scraping
      result = await this.performScrape(job)

      // Cache successful results
      if (result.success && !job.options.skipCache) {
        this.setCache(cacheKey, result)
      }

      this.completeJob(job, result)

    } catch (error) {
      const errorResult: ScrapingResult = {
        success: false,
        url: job.url,
        error: {
          code: this.getErrorCode(error),
          message: error instanceof Error ? error.message : String(error),
          retryable: this.isRetryableError(error)
        },
        timing: { total: Date.now() - startTime },
        cache: { hit: false },
        metadata: { size: 0 }
      }

      // Retry logic
      if (errorResult.error?.retryable && job.retryCount! < this.config.maxRetries) {
        job.retryCount = (job.retryCount || 0) + 1
        
        // Exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, job.retryCount - 1)
        
        setTimeout(() => {
          this.addJobToQueue(job)
        }, delay)

        logger.info('Retrying job', { 
          metadata: { 
            jobId: job.id, 
            url: job.url, 
            retryCount: job.retryCount, 
            delay 
          } 
        })

        // Remove from active jobs for retry
        this.activeJobs.delete(job.id)
        this.stats.concurrent.active = this.activeJobs.size
        return
      }

      this.completeJob(job, errorResult)
    }
  }

  private async performScrape(job: ScrapingJob): Promise<ScrapingResult> {
    const startTime = Date.now()
    const timings = { dns: 0, connect: 0, ssl: 0, download: 0 }
    
    // Enhanced timeout configuration based on job priority
    const baseTimeout = job.options.timeout || this.config.timeout
    const priorityMultiplier = job.options.priority === 'high' ? 1.5 : job.options.priority === 'low' ? 0.7 : 1
    const adjustedTimeout = Math.min(baseTimeout * priorityMultiplier, 25000) // Cap at 25 seconds
    
    const config: AxiosRequestConfig = {
      method: job.options.method || 'GET',
      url: job.url,
      timeout: adjustedTimeout,
      maxRedirects: job.options.maxRedirects || 3, // Reduced redirects to prevent loops
      headers: {
        ...this.config.headers,
        ...job.options.headers,
        'User-Agent': this.config.userAgent
      },
      validateStatus: () => true, // Don't throw on HTTP errors
      responseType: 'text',
      decompress: true,
    }

    // Disable SSL verification if requested
    if (job.options.validateSSL === false) {
      (config as any).httpsAgent = new (require('https').Agent)({
        rejectUnauthorized: false
      })
    }

    let response: AxiosResponse
    let redirectChain: string[] = []

    try {
      // Track redirects
      config.beforeRedirect = (options: any, responseDetails: any) => {
        redirectChain.push(responseDetails.headers.location || responseDetails.url)
      }

      response = await axios(config)

      const endTime = Date.now()
      timings.download = endTime - startTime

      // Update stats
      this.stats.total.requests++
      this.updateTimingStats(timings.download)

      if (response.status >= 200 && response.status < 400) {
        this.stats.total.success++
      } else {
        this.stats.total.errors++
        this.updateErrorStats(response.status.toString())
      }

      const html = response.data
      const size = Buffer.byteLength(html, 'utf8')
      this.stats.total.bytes += size

      // Convert axios headers to safe Record<string, string>
      const safeHeaders = this.normalizeHeaders(response.headers)

      return {
        success: response.status >= 200 && response.status < 400,
        url: job.url,
        finalUrl: response.request.res?.responseUrl || job.url,
        statusCode: response.status,
        headers: safeHeaders,
        html,
        redirectChain: redirectChain.length > 0 ? redirectChain : undefined,
        timing: {
          total: endTime - startTime,
          dns: timings.dns,
          connect: timings.connect,
          ssl: timings.ssl,
          download: timings.download
        },
        cache: { hit: false },
        metadata: {
          size,
          encoding: this.detectEncoding(safeHeaders),
          contentType: safeHeaders['content-type'],
          lastModified: safeHeaders['last-modified'],
          etag: safeHeaders['etag']
        }
      }

    } catch (error) {
      this.stats.total.errors++
      this.updateErrorStats(this.getErrorCode(error))
      throw error
    }
  }

  private completeJob(job: ScrapingJob, result: ScrapingResult): void {
    job.completedAt = Date.now()
    
    // Remove from active jobs
    this.activeJobs.delete(job.id)
    this.stats.concurrent.active = this.activeJobs.size
    this.stats.concurrent.completed++

    // Resolve promise
    const resolve = (job as any).resolve
    const reject = (job as any).reject

    if (result.success) {
      resolve(result)
    } else if (result.error) {
      const error = new Error(result.error.message)
      ;(error as any).code = result.error.code
      ;(error as any).retryable = result.error.retryable
      ;(error as any).result = result
      reject(error)
    } else {
      reject(new Error('Unknown scraping error'))
    }
  }

  private getFromCache(key: string): ScrapingResult | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    
    // Check if expired
    if (now > entry.expiresAt) {
      this.cache.delete(key)
      this.updateCacheStats()
      return null
    }

    // Update access stats
    entry.accessCount++
    entry.lastAccessed = now

    return entry.result
  }

  private setCache(key: string, result: ScrapingResult): void {
    const now = Date.now()
    const size = Buffer.byteLength(JSON.stringify(result), 'utf8')

    // Check cache size limits
    this.evictIfNeeded(size)

    const entry: CacheEntry = {
      key,
      url: result.url,
      result,
      createdAt: now,
      accessCount: 1,
      lastAccessed: now,
      expiresAt: now + this.config.cacheTTL,
      size,
      tags: this.generateCacheTags(result.url)
    }

    this.cache.set(key, entry)
    this.updateCacheStats()
  }

  private evictIfNeeded(newEntrySize: number): void {
    let currentSize = this.getCacheSize()
    
    if (currentSize + newEntrySize <= this.config.maxCacheSize) {
      return
    }

    // Sort by access frequency and age (LFU + LRU hybrid)
    const entries = Array.from(this.cache.values()).sort((a, b) => {
      const aScore = a.accessCount / (Date.now() - a.createdAt) * 1000
      const bScore = b.accessCount / (Date.now() - b.createdAt) * 1000
      return aScore - bScore // Lower score = less valuable
    })

    // Remove entries until we have enough space
    for (const entry of entries) {
      this.cache.delete(entry.key)
      currentSize -= entry.size
      
      if (currentSize + newEntrySize <= this.config.maxCacheSize) {
        break
      }
    }

    this.updateCacheStats()
  }

  private getCacheSize(): number {
    return Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0)
  }

  private updateCacheStats(): void {
    this.stats.cache.entries = this.cache.size
    this.stats.cache.size = this.getCacheSize()
    
    const total = this.stats.cache.hits + this.stats.cache.misses
    this.stats.cache.hitRate = total > 0 ? (this.stats.cache.hits / total) * 100 : 0
  }

  private updateTimingStats(duration: number): void {
    this.stats.timing.min = Math.min(this.stats.timing.min, duration)
    this.stats.timing.max = Math.max(this.stats.timing.max, duration)
    
    // Simple moving average (could be improved with proper percentile tracking)
    const total = this.stats.total.requests
    this.stats.timing.average = ((this.stats.timing.average * (total - 1)) + duration) / total
    
    // Rough P95 estimate (would need proper percentile tracking in production)
    this.stats.timing.p95 = this.stats.timing.average + (this.stats.timing.max - this.stats.timing.average) * 0.95
  }

  private updateErrorStats(errorCode: string): void {
    this.stats.errors[errorCode] = (this.stats.errors[errorCode] || 0) + 1
  }

  private refillTokens(): void {
    const now = Date.now()
    const elapsed = now - this.lastTokenRefill
    const tokensToAdd = Math.floor(elapsed / 1000 * this.config.rateLimit.requestsPerSecond)
    
    if (tokensToAdd > 0) {
      this.rateLimitTokens = Math.min(
        this.config.rateLimit.burstSize,
        this.rateLimitTokens + tokensToAdd
      )
      this.lastTokenRefill = now
    }
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateCacheKey(url: string, options: ScrapingJob['options']): string {
    const key = `${url}:${JSON.stringify(options)}`
    return Buffer.from(key).toString('base64')
  }

  private generateCacheTags(url: string): string[] {
    try {
      const urlObj = new URL(url)
      return [
        urlObj.hostname,
        urlObj.hostname.replace('www.', ''),
        urlObj.protocol.replace(':', ''),
        'scraping'
      ]
    } catch {
      return ['scraping', 'invalid-url']
    }
  }

  private normalizeHeaders(headers: any): Record<string, string> {
    const normalized: Record<string, string> = {}
    
    if (headers && typeof headers === 'object') {
      for (const [key, value] of Object.entries(headers)) {
        if (value !== undefined && value !== null) {
          normalized[key.toLowerCase()] = String(value)
        }
      }
    }
    
    return normalized
  }

  private detectEncoding(headers: Record<string, string>): string {
    const contentType = headers['content-type'] || ''
    const match = contentType.match(/charset=([^;]+)/)
    return match ? match[1].toLowerCase() : 'utf-8'
  }

  private getErrorCode(error: any): string {
    if (error?.code) return error.code
    if (error?.response?.status) return `HTTP_${error.response.status}`
    if (error?.message?.includes('timeout') || error?.code === 'ECONNABORTED') return 'TIMEOUT'
    if (error?.message?.includes('ENOTFOUND')) return 'DNS_ERROR'
    if (error?.message?.includes('ECONNREFUSED')) return 'CONNECTION_REFUSED'
    if (error?.message?.includes('ECONNRESET')) return 'CONNECTION_RESET'
    if (error?.message?.includes('certificate') || error?.message?.includes('SSL')) return 'SSL_ERROR'
    if (error?.message?.includes('network') || error?.message?.includes('ENETUNREACH')) return 'NETWORK_ERROR'
    return 'UNKNOWN_ERROR'
  }

  private isRetryableError(error: any): boolean {
    const retryableCodes = [
      'TIMEOUT', 'CONNECTION_REFUSED', 'CONNECTION_RESET', 'ECONNRESET',
      'ENOTFOUND', 'HTTP_429', 'HTTP_502', 'HTTP_503', 'HTTP_504', 'NETWORK_ERROR'
    ]
    const nonRetryableCodes = [
      'HTTP_400', 'HTTP_401', 'HTTP_403', 'HTTP_404', 'HTTP_405', 'HTTP_410',
      'SSL_ERROR' // Don't retry SSL certificate errors
    ]
    const errorCode = this.getErrorCode(error)
    
    // Don't retry if explicitly non-retryable
    if (nonRetryableCodes.includes(errorCode)) {
      return false
    }
    
    return retryableCodes.includes(errorCode)
  }

  // Public methods for management and monitoring
  public getStats(): ScraperStats {
    return { ...this.stats }
  }

  public clearCache(tags?: string[]): number {
    if (!tags) {
      const size = this.cache.size
      this.cache.clear()
      this.updateCacheStats()
      return size
    }

    let cleared = 0
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (tags.some(tag => entry.tags.includes(tag))) {
        this.cache.delete(key)
        cleared++
      }
    }
    
    this.updateCacheStats()
    return cleared
  }

  public warmCache(urls: string[], options: ScrapingJob['options'] = {}): Promise<void> {
    return this.scrapeMultiple(urls, { ...options, priority: 'low' }).then(() => {})
  }

  public stop(): void {
    this.processing = false
    if (this.processInterval) {
      clearInterval(this.processInterval)
      this.processInterval = null
    }
    
    // Wait for active jobs to complete (or timeout)
    // In production, you might want to forcefully cancel them
  }

  public destroy(): void {
    this.stop()
    this.cache.clear()
    this.jobQueue.length = 0
    this.activeJobs.clear()
  }
}

// Utility class for managing concurrency
class Semaphore {
  private permits: number
  private waitQueue: (() => void)[]

  constructor(permits: number) {
    this.permits = permits
    this.waitQueue = []
  }

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--
        resolve(() => this.release())
      } else {
        this.waitQueue.push(() => {
          this.permits--
          resolve(() => this.release())
        })
      }
    })
  }

  private release(): void {
    this.permits++
    const next = this.waitQueue.shift()
    if (next) {
      next()
    }
  }
}

// Global scraper instance
export const optimizedScraper = new OptimizedScraper()

// Enhanced scraping utilities
export class ScrapingUtils {
  static extractMetadata(html: string, url: string): {
    title?: string
    description?: string
    keywords?: string
    author?: string
    ogData?: Record<string, string>
    twitterData?: Record<string, string>
    schemaOrg?: any[]
    links?: { internal: string[]; external: string[] }
    images?: string[]
  } {
    const $ = cheerio.load(html) as cheerio.CheerioAPI as cheerio.CheerioAPI as cheerio.CheerioAPI
    
    return {
      title: $('title').text().trim() || undefined,
      description: $('meta[name="description"]').attr('content') || 
                  $('meta[property="og:description"]').attr('content') || undefined,
      keywords: $('meta[name="keywords"]').attr('content') || undefined,
      author: $('meta[name="author"]').attr('content') || undefined,
      
      ogData: this.extractOpenGraph($),
      twitterData: this.extractTwitterCards($),
      schemaOrg: this.extractSchemaOrg($),
      
      links: this.extractLinks($, url),
      images: this.extractImages($, url)
    }
  }

  private static extractOpenGraph($: cheerio.CheerioAPI): Record<string, string> {
    const ogData: Record<string, string> = {}
    
    $('meta[property^="og:"]').each((_, el) => {
      const property = $(el).attr('property')
      const content = $(el).attr('content')
      if (property && content) {
        ogData[property] = content
      }
    })
    
    return ogData
  }

  private static extractTwitterCards($: cheerio.CheerioAPI): Record<string, string> {
    const twitterData: Record<string, string> = {}
    
    $('meta[name^="twitter:"]').each((_, el) => {
      const name = $(el).attr('name')
      const content = $(el).attr('content')
      if (name && content) {
        twitterData[name] = content
      }
    })
    
    return twitterData
  }

  private static extractSchemaOrg($: cheerio.CheerioAPI): any[] {
    const schemas: any[] = []
    
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const content = $(el).html()
        if (content) {
          schemas.push(JSON.parse(content))
        }
      } catch (error) {
        // Ignore invalid JSON
      }
    })
    
    return schemas
  }

  private static extractLinks($: cheerio.CheerioAPI, baseUrl: string): {
    internal: string[]
    external: string[]
  } {
    const internal: string[] = []
    const external: string[] = []
    const baseHost = new URL(baseUrl).hostname
    
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')
      if (!href) return
      
      try {
        const fullUrl = new URL(href, baseUrl)
        if (fullUrl.hostname === baseHost) {
          internal.push(fullUrl.toString())
        } else {
          external.push(fullUrl.toString())
        }
      } catch {
        // Ignore invalid URLs
      }
    })
    
    return { internal, external }
  }

  private static extractImages($: cheerio.CheerioAPI, baseUrl: string): string[] {
    const images: string[] = []
    
    $('img[src]').each((_, el) => {
      const src = $(el).attr('src')
      if (!src) return
      
      try {
        const fullUrl = new URL(src, baseUrl)
        images.push(fullUrl.toString())
      } catch {
        // Ignore invalid URLs
      }
    })
    
    return images
  }
}
