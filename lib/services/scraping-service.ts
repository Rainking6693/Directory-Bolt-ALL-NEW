// 🔒 JORDAN'S WEB SCRAPING SERVICE - Enterprise-grade scraping with job queue
// Handles directory discovery, contact extraction, and submission verification

import type { ScrapingJob, JobStatus } from '../database/schema'

// Job queue configuration
interface JobQueue {
  jobs: Map<string, ScrapingJob>
  processing: Set<string>
  workers: number
  maxRetries: number
  retryDelay: number
}

const jobQueue: JobQueue = {
  jobs: new Map(),
  processing: new Set(),
  workers: 3, // Concurrent workers
  maxRetries: 3,
  retryDelay: 5000 // 5 seconds base delay
}

// Rate limiting for different domains
const domainLimits = new Map<string, {
  requestsPerMinute: number
  lastRequests: number[]
  blocked: boolean
  blockedUntil?: number
}>()

// User agents for rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
]

export class ScrapingService {
  private static instance: ScrapingService
  private isProcessing = false
  
  static getInstance(): ScrapingService {
    if (!ScrapingService.instance) {
      ScrapingService.instance = new ScrapingService()
    }
    return ScrapingService.instance
  }
  
  // Add job to queue with priority
  async addJob(job: Omit<ScrapingJob, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const fullJob: ScrapingJob = {
      ...job,
      id: jobId,
      status: 'queued',
      attempts: 0,
      created_at: new Date(),
      updated_at: new Date()
    }
    
    jobQueue.jobs.set(jobId, fullJob)
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing()
    }
    
    console.log(`🕷️ Queued scraping job: ${jobId} for ${job.target_url}`)
    return jobId
  }
  
  // Get job status
  getJob(jobId: string): ScrapingJob | null {
    return jobQueue.jobs.get(jobId) || null
  }
  
  // Start job processing workers
  private async startProcessing() {
    if (this.isProcessing) return
    
    this.isProcessing = true
    console.log('🚀 Starting scraping job processors...')
    
    // Start multiple workers
    for (let i = 0; i < jobQueue.workers; i++) {
      this.processJobs()
    }
  }
  
  // Process jobs from queue
  private async processJobs() {
    while (true) {
      const job = this.getNextJob()
      if (!job) {
        await this.sleep(1000) // Wait 1 second before checking again
        continue
      }
      
      await this.processJob(job)
    }
  }
  
  // Get next job to process (priority queue)
  private getNextJob(): ScrapingJob | null {
    const now = Date.now()
    
    // Find jobs ready to process, sorted by priority and scheduled time
    const readyJobs = Array.from(jobQueue.jobs.values())
      .filter(job => 
        job.status === 'queued' && 
        job.scheduled_for.getTime() <= now &&
        (!job.delay_until || job.delay_until.getTime() <= now) &&
        !jobQueue.processing.has(job.id)
      )
      .sort((a, b) => {
        // Sort by priority first (1 = highest), then by scheduled time
        if (a.priority !== b.priority) {
          return a.priority - b.priority
        }
        return a.scheduled_for.getTime() - b.scheduled_for.getTime()
      })
    
    return readyJobs[0] || null
  }
  
  // Process individual job
  private async processJob(job: ScrapingJob) {
    jobQueue.processing.add(job.id)
    
    // Update job status
    job.status = 'processing'
    job.started_at = new Date()
    job.updated_at = new Date()
    job.attempts++
    
    console.log(`🔄 Processing job ${job.id}: ${job.type} for ${job.target_url}`)
    
    try {
      // Check rate limits before processing
      if (!await this.checkRateLimit(job.target_url)) {
        throw new Error('Rate limit exceeded for domain')
      }
      
      let result: any
      
      switch (job.type) {
        case 'directory_discovery':
          result = await this.discoverDirectory(job.target_url, job.payload)
          break
        case 'contact_extraction':
          result = await this.extractContacts(job.target_url, job.payload)
          break
        case 'submission_verification':
          result = await this.verifySubmission(job.target_url, job.payload)
          break
        default:
          throw new Error(`Unknown job type: ${job.type}`)
      }
      
      // Job completed successfully
      job.status = 'completed'
      job.completed_at = new Date()
      job.result = result
      job.updated_at = new Date()
      
      console.log(`✅ Completed job ${job.id}`)
      
    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error)
      
      job.error_message = error instanceof Error ? error.message : 'Unknown error'
      job.error_stack = error instanceof Error ? error.stack : undefined
      job.updated_at = new Date()
      
      // Retry logic
      if (job.attempts < job.max_attempts) {
        job.status = 'retrying'
        // Exponential backoff
        const delayMs = jobQueue.retryDelay * Math.pow(2, job.attempts - 1)
        job.delay_until = new Date(Date.now() + delayMs)
        job.scheduled_for = new Date(Date.now() + delayMs)
        
        console.log(`🔄 Retrying job ${job.id} in ${delayMs}ms (attempt ${job.attempts}/${job.max_attempts})`)
      } else {
        job.status = 'failed'
        job.failed_at = new Date()
        console.error(`💀 Job ${job.id} permanently failed after ${job.attempts} attempts`)
      }
    } finally {
      jobQueue.processing.delete(job.id)
    }
  }
  
  // Directory discovery scraping
  private async discoverDirectory(url: string, _payload: any): Promise<any> {
    const response = await this.makeRequest(url)
    const html = response.body
    
    // Extract directory metadata
    const metadata = {
      title: this.extractTitle(html),
      description: this.extractMetaDescription(html),
      submissionForm: this.findSubmissionForm(html),
      contactInfo: this.extractContactInfo(html),
      guidelines: this.extractGuidelines(html),
      domainAuthority: await this.calculateDomainAuthority(url),
      responseTime: response.responseTime
    }
    
    console.log(`🔍 Discovered directory info for ${url}:`, metadata.title)
    return metadata
  }
  
  // Contact extraction scraping
  private async extractContacts(url: string, _payload: any): Promise<any> {
    const response = await this.makeRequest(url)
    const html = response.body
    
    const contacts = {
      emails: this.extractEmails(html),
      phones: this.extractPhones(html),
      addresses: this.extractAddresses(html),
      socialMedia: this.extractSocialLinks(html),
      contactForms: this.findContactForms(html)
    }
    
    console.log(`📧 Extracted ${contacts.emails.length} emails from ${url}`)
    return contacts
  }
  
  // Submission verification scraping
  private async verifySubmission(url: string, payload: any): Promise<any> {
    const { submissionId, businessName } = payload
    
    // Check if submission appears on the directory
    const response = await this.makeRequest(url)
    const html = response.body
    
    const isListed = html.toLowerCase().includes(businessName.toLowerCase())
    const listingUrl = isListed ? this.findBusinessListingUrl(html, businessName) : null
    
    const verification = {
      isListed,
      listingUrl,
      submissionId,
      verifiedAt: new Date().toISOString(),
      screenshot: null // TODO: Add screenshot capability
    }
    
    console.log(`✅ Verified submission for ${businessName}: ${isListed ? 'FOUND' : 'NOT FOUND'}`)
    return verification
  }
  
  // HTTP request with error handling and rate limiting
  private async makeRequest(url: string): Promise<{ body: string; responseTime: number; statusCode: number }> {
    const startTime = Date.now()
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
    
    try {
      // Simulate HTTP request (replace with actual HTTP client like axios/fetch)
      await this.sleep(Math.random() * 2000 + 500) // Simulate network delay
      
      const responseTime = Date.now() - startTime
      
      // Mock response for development
      const mockResponse = {
        body: `<html><head><title>Directory Site</title></head><body><h1>Business Directory</h1></body></html>`,
        responseTime,
        statusCode: 200
      }
      
      // Record request for rate limiting
      this.recordRequest(url)
      
      return mockResponse
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error)
      throw error
    }
  }
  
  // Rate limiting check
  private async checkRateLimit(url: string): Promise<boolean> {
    const domain = new URL(url).hostname
    const limit = domainLimits.get(domain)
    const now = Date.now()
    
    if (!limit) {
      // Initialize rate limit for new domain
      domainLimits.set(domain, {
        requestsPerMinute: 10, // Default: 10 requests per minute
        lastRequests: [],
        blocked: false
      })
      return true
    }
    
    if (limit.blocked && limit.blockedUntil && now < limit.blockedUntil) {
      return false
    }
    
    // Clean old requests (older than 1 minute)
    limit.lastRequests = limit.lastRequests.filter(time => now - time < 60000)
    
    if (limit.lastRequests.length >= limit.requestsPerMinute) {
      // Block for 5 minutes
      limit.blocked = true
      limit.blockedUntil = now + 300000 // 5 minutes
      console.warn(`⚠️ Rate limit exceeded for ${domain}, blocked for 5 minutes`)
      return false
    }
    
    return true
  }
  
  // Record request for rate limiting
  private recordRequest(url: string) {
    const domain = new URL(url).hostname
    const limit = domainLimits.get(domain)
    
    if (limit) {
      limit.lastRequests.push(Date.now())
    }
  }
  
  // Utility functions for HTML parsing
  private extractTitle(html: string): string {
    const match = html.match(/<title>(.*?)<\/title>/i)
    return match ? match[1].trim() : 'Unknown Directory'
  }
  
  private extractMetaDescription(html: string): string {
    const match = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i)
    return match ? match[1].trim() : ''
  }
  
  private findSubmissionForm(html: string): string | null {
    // Look for forms with submission-related keywords
    const formPatterns = [
      /action=["'](.*?submit.*?)["']/i,
      /action=["'](.*?add.*?)["']/i,
      /action=["'](.*?register.*?)["']/i
    ]
    
    for (const pattern of formPatterns) {
      const match = html.match(pattern)
      if (match) return match[1]
    }
    
    return null
  }
  
  private extractContactInfo(html: string): { emails: string[]; phones: string[] } {
    return {
      emails: this.extractEmails(html),
      phones: this.extractPhones(html)
    }
  }
  
  private extractEmails(html: string): string[] {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
    return (html.match(emailRegex) || []).filter(email => 
      !email.includes('example.com') && 
      !email.includes('placeholder')
    )
  }
  
  private extractPhones(html: string): string[] {
    const phoneRegex = /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g
    return html.match(phoneRegex) || []
  }
  
  private extractAddresses(html: string): string[] {
    // Simple address extraction (can be enhanced)
    const addressPatterns = [
      /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln)[A-Za-z\s,]*\d{5}/g
    ]
    
    const addresses: string[] = []
    for (const pattern of addressPatterns) {
      const matches = html.match(pattern) || []
      addresses.push(...matches)
    }
    
    return addresses
  }
  
  private extractSocialLinks(html: string): string[] {
    const socialPatterns = [
      /https?:\/\/(?:www\.)?(?:facebook|twitter|linkedin|instagram|youtube)\.com\/[A-Za-z0-9._-]+/g
    ]
    
    const links: string[] = []
    for (const pattern of socialPatterns) {
      const matches = html.match(pattern) || []
      links.push(...matches)
    }
    
    return links
  }
  
  private findContactForms(html: string): string[] {
    // Look for contact form URLs
    const formPatterns = [
      /action=["'](.*?contact.*?)["']/gi,
      /href=["'](.*?contact.*?)["']/gi
    ]
    
    const forms: string[] = []
    for (const pattern of formPatterns) {
      const matches = html.match(pattern) || []
      forms.push(...matches.map(match => match.replace(/.*["']([^"']+)["'].*/, '$1')))
    }
    
    return [...new Set(forms)] // Remove duplicates
  }
  
  private extractGuidelines(html: string): string {
    // Look for submission guidelines or terms
    const guidelineKeywords = ['guideline', 'rule', 'requirement', 'submit', 'add your', 'listing']
    // This would be more sophisticated in practice
    return 'Please review submission guidelines on the directory website.'
  }
  
  private async calculateDomainAuthority(url: string): Promise<number> {
    // Mock domain authority calculation
    // In production, integrate with SEO APIs like Moz or Ahrefs
    const domain = new URL(url).hostname
    const popularDomains = ['google.com', 'facebook.com', 'linkedin.com', 'yelp.com']
    
    if (popularDomains.some(d => domain.includes(d))) {
      return Math.floor(Math.random() * 10) + 90 // 90-100
    }
    
    return Math.floor(Math.random() * 50) + 30 // 30-80
  }
  
  private findBusinessListingUrl(html: string, businessName: string): string | null {
    // Look for specific business listing URL
    const regex = new RegExp(`href=["'](.*?)["'][^>]*>.*?${businessName}.*?</a>`, 'i')
    const match = html.match(regex)
    return match ? match[1] : null
  }
  
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export singleton instance
export const scrapingService = ScrapingService.getInstance()

// Job management utilities
export async function scheduleDirectoryDiscovery(url: string, directoryId: string): Promise<string> {
  return await scrapingService.addJob({
    type: 'directory_discovery',
    target_url: url,
    payload: { directory_id: directoryId },
    status: 'queued',
    priority: 2,
    attempts: 0,
    max_attempts: 3,
    scheduled_for: new Date(),
    rate_limit_key: new URL(url).hostname
  })
}

export async function scheduleContactExtraction(url: string, businessId: string): Promise<string> {
  return await scrapingService.addJob({
    type: 'contact_extraction',
    target_url: url,
    payload: { business_id: businessId },
    status: 'queued',
    priority: 3,
    attempts: 0,
    max_attempts: 3,
    scheduled_for: new Date(),
    rate_limit_key: new URL(url).hostname
  })
}

export async function scheduleSubmissionVerification(
  url: string, 
  submissionId: string, 
  businessName: string
): Promise<string> {
  // Schedule verification for 24 hours later
  const scheduledFor = new Date()
  scheduledFor.setHours(scheduledFor.getHours() + 24)
  
  return await scrapingService.addJob({
    type: 'submission_verification',
    target_url: url,
    payload: { submission_id: submissionId, business_name: businessName },
    status: 'queued',
    priority: 4,
    attempts: 0,
    max_attempts: 5,
    scheduled_for: scheduledFor,
    rate_limit_key: new URL(url).hostname
  })
}
