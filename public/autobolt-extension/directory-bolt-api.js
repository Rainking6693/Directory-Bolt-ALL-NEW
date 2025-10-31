/**
 * DirectoryBolt API Client for AutoBolt Extension
 * 
 * SECURITY ENHANCED VERSION - Uses chrome.storage.sync for secure API key management
 * Provides secure API communication with DirectoryBolt backend
 * Replaces all direct Supabase database calls
 * 
 * Phase 3 - Task 3.1 Security Implementation
 * Agent: Alex (Full-Stack Engineer)
 */

class DirectoryBoltAPI {
  constructor() {
    this.baseUrl = 'https://directorybolt.com'
    this.apiKey = null // NEVER store API keys in code
    this.extensionId = chrome.runtime.id || 'autobolt-extension'
    this.timeout = 30000 // 30 seconds
    this.initialized = false
  }

  /**
   * Initialize API client with secure API key from storage
   * @returns {Promise<boolean>} True if initialization successful
   */
  async initialize() {
    try {
      console.log('🔄 DirectoryBoltAPI: Initializing with secure API key...')
      
      // Get API key from secure storage
      const result = await chrome.storage.sync.get(['autobolt_api_key'])
      
      if (!result.autobolt_api_key) {
        console.error('❌ DirectoryBoltAPI: No API key found in storage')
        throw new Error('API key not configured. Please contact support.')
      }

      this.apiKey = result.autobolt_api_key
      this.initialized = true
      
      console.log('✅ DirectoryBoltAPI: Initialized successfully with secure API key')
      return true

    } catch (error) {
      console.error('❌ DirectoryBoltAPI: Initialization failed:', error)
      this.initialized = false
      throw new Error(`Failed to initialize API client: ${error.message}`)
    }
  }

  /**
   * Set API key securely in chrome.storage.sync
   * @param {string} apiKey - The API key to store securely
   * @returns {Promise<boolean>} True if storage successful
   */
  async setApiKey(apiKey) {
    try {
      if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 32) {
        throw new Error('Invalid API key format')
      }

      console.log('🔄 DirectoryBoltAPI: Storing API key securely...')
      
      await chrome.storage.sync.set({ autobolt_api_key: apiKey })
      this.apiKey = apiKey
      this.initialized = true
      
      console.log('✅ DirectoryBoltAPI: API key stored securely')
      return true

    } catch (error) {
      console.error('❌ DirectoryBoltAPI: Failed to store API key:', error)
      throw new Error(`Failed to store API key: ${error.message}`)
    }
  }

  /**
   * Check if API client is properly initialized
   * @returns {boolean} True if initialized
   */
  isInitialized() {
    return this.initialized && this.apiKey !== null
  }

  /**
   * Get the next job from the processing queue
   * @returns {Promise<Object>} Job data or null if no jobs available
   */
  async getNextJob() {
    await this._ensureInitialized()
    
    try {
      console.log('🔄 DirectoryBoltAPI: Fetching next job from queue...')
      
      const response = await this._makeRequest('/api/autobolt/jobs/next', {
        method: 'GET'
      })

      if (response.success && response.data) {
        console.log('✅ DirectoryBoltAPI: Job retrieved successfully:', response.data.jobId)
        return {
          jobId: response.data.jobId,
          customerId: response.data.customerId,
          customerName: response.data.customerName,
          customerEmail: response.data.customerEmail,
          packageType: response.data.packageType,
          directoryLimit: response.data.directoryLimit,
          businessData: response.data.businessData,
          createdAt: response.data.createdAt
        }
      } else if (response.success && response.message === 'No jobs currently in queue') {
        console.log('ℹ️ DirectoryBoltAPI: No jobs available in queue')
        return null
      } else {
        throw new Error(response.error || 'Failed to fetch next job')
      }

    } catch (error) {
      console.error('❌ DirectoryBoltAPI: Error getting next job:', error)
      throw new Error(`Failed to get next job: ${error.message}`)
    }
  }

  /**
   * Update job progress with directory submission results
   * @param {string} jobId - The job ID to update
   * @param {Array} directoryResults - Array of directory submission results
   * @param {string} status - Optional status update ('in_progress', 'paused', 'failed')
   * @param {string} errorMessage - Optional error message
   * @returns {Promise<Object>} Update result with progress stats
   */
  async updateJobProgress(jobId, directoryResults = [], status = null, errorMessage = null) {
    await this._ensureInitialized()
    
    try {
      console.log(`🔄 DirectoryBoltAPI: Updating job ${jobId} with ${directoryResults.length} results...`)
      
      const requestBody = {
        jobId,
        directoryResults: directoryResults.map(result => this._formatDirectoryResult(result)),
        status,
        errorMessage
      }

      const response = await this._makeRequest('/api/autobolt/jobs/update', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      if (response.success) {
        console.log('✅ DirectoryBoltAPI: Job progress updated successfully')
        return {
          jobId: response.data.jobId,
          progressPercentage: response.data.progressPercentage,
          directoriesCompleted: response.data.directoriesCompleted,
          directoriesFailed: response.data.directoriesFailed,
          resultsAdded: response.data.resultsAdded
        }
      } else {
        throw new Error(response.error || 'Failed to update job progress')
      }

    } catch (error) {
      console.error('❌ DirectoryBoltAPI: Error updating job progress:', error)
      throw new Error(`Failed to update job progress: ${error.message}`)
    }
  }

  /**
   * Complete a job with final status and summary
   * @param {string} jobId - The job ID to complete
   * @param {string} status - Final status ('completed', 'failed', 'cancelled')
   * @param {Object} summary - Processing summary statistics
   * @param {string} errorMessage - Optional error message for failed jobs
   * @param {Object} finalResults - Optional final processing results
   * @returns {Promise<Object>} Completion result
   */
  async completeJob(jobId, status, summary = null, errorMessage = null, finalResults = null) {
    await this._ensureInitialized()
    
    try {
      console.log(`🔄 DirectoryBoltAPI: Completing job ${jobId} with status ${status}...`)
      
      const requestBody = {
        jobId,
        status,
        summary: summary ? {
          totalDirectories: summary.totalDirectories || 0,
          successfulSubmissions: summary.successfulSubmissions || 0,
          failedSubmissions: summary.failedSubmissions || 0,
          skippedDirectories: summary.skippedDirectories || 0,
          processingTimeMinutes: summary.processingTimeMinutes || 0
        } : null,
        errorMessage,
        finalResults
      }

      const response = await this._makeRequest('/api/autobolt/jobs/complete', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      if (response.success) {
        console.log('✅ DirectoryBoltAPI: Job completed successfully')
        return {
          jobId: response.data.jobId,
          customerId: response.data.customerId,
          finalStatus: response.data.finalStatus,
          progressPercentage: response.data.progressPercentage,
          directoriesCompleted: response.data.directoriesCompleted,
          directoriesFailed: response.data.directoriesFailed,
          processingTimeMinutes: response.data.processingTimeMinutes,
          completedAt: response.data.completedAt
        }
      } else {
        throw new Error(response.error || 'Failed to complete job')
      }

    } catch (error) {
      console.error('❌ DirectoryBoltAPI: Error completing job:', error)
      throw new Error(`Failed to complete job: ${error.message}`)
    }
  }

  /**
   * Test API connectivity and authentication
   * @returns {Promise<boolean>} True if API is accessible
   */
  async testConnection() {
    try {
      console.log('🔄 DirectoryBoltAPI: Testing connection...')
      
      if (!this.isInitialized()) {
        await this.initialize()
      }
      
      // Make a test call to get next job (will return no jobs available, but validates auth)
      await this._makeRequest('/api/autobolt/jobs/next', {
        method: 'GET'
      })
      
      console.log('✅ DirectoryBoltAPI: Connection test successful')
      return true

    } catch (error) {
      console.error('❌ DirectoryBoltAPI: Connection test failed:', error)
      return false
    }
  }

  /**
   * Private method to ensure API client is initialized before use
   * @private
   */
  async _ensureInitialized() {
    if (!this.isInitialized()) {
      await this.initialize()
    }
    
    if (!this.isInitialized()) {
      throw new Error('API client not initialized. Please contact support.')
    }
  }

  /**
   * Private method to make authenticated API requests
   * @param {string} endpoint - API endpoint path
   * @param {Object} options - Request options
   * @returns {Promise<Object>} API response
   * @private
   */
  async _makeRequest(endpoint, options = {}) {
    if (!this.apiKey) {
      throw new Error('API key not available. Please contact support.')
    }

    const url = `${this.baseUrl}${endpoint}`
    
    const requestOptions = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'x-extension-id': this.extensionId,
        'User-Agent': 'AutoBolt-Extension/3.0.1',
        ...options.headers
      }
    }

    // Add timeout handling
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)
    requestOptions.signal = controller.signal

    try {
      const response = await fetch(url, requestOptions)
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return data

    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please try again')
      } else if (error.message.includes('network')) {
        throw new Error('Network error - please check your connection')
      } else {
        throw error
      }
    }
  }

  /**
   * Private method to format directory results for API
   * @param {Object} result - Raw directory result
   * @returns {Object} Formatted result for API
   * @private
   */
  _formatDirectoryResult(result) {
    return {
      directoryName: result.directoryName || '',
      directoryUrl: result.directoryUrl || '',
      directoryCategory: result.directoryCategory || 'business',
      directoryTier: result.directoryTier || 'standard',
      submissionStatus: result.submissionStatus || 'pending',
      listingUrl: result.listingUrl || null,
      submissionResult: result.submissionResult || null,
      rejectionReason: result.rejectionReason || null,
      domainAuthority: result.domainAuthority || null,
      estimatedTraffic: result.estimatedTraffic || null,
      submissionScore: result.submissionScore || null,
      processingTimeSeconds: result.processingTimeSeconds || null,
      errorMessage: result.errorMessage || null
    }
  }

  /**
   * Get API client information (excluding sensitive data)
   * @returns {Object} Client information
   */
  getClientInfo() {
    return {
      baseUrl: this.baseUrl,
      extensionId: this.extensionId,
      timeout: this.timeout,
      version: '3.0.1',
      initialized: this.initialized,
      hasApiKey: !!this.apiKey
    }
  }

  /**
   * Clear stored API key (for security/logout)
   * @returns {Promise<boolean>} True if cleared successfully
   */
  async clearApiKey() {
    try {
      await chrome.storage.sync.remove(['autobolt_api_key'])
      this.apiKey = null
      this.initialized = false
      
      console.log('✅ DirectoryBoltAPI: API key cleared securely')
      return true

    } catch (error) {
      console.error('❌ DirectoryBoltAPI: Failed to clear API key:', error)
      return false
    }
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DirectoryBoltAPI
} else {
  // Make available globally for Chrome extension
  window.DirectoryBoltAPI = DirectoryBoltAPI
}

console.log('✅ DirectoryBoltAPI class loaded successfully (SECURE VERSION)')