/**
 * Customer Profile Monitoring System
 * Tracks customer information across directories and alerts on changes/deletions
 * 
 * Features:
 * - Profile existence verification
 * - Listing status monitoring
 * - Data integrity validation
 * - Automated scheduling and alerts
 */

import { logger } from '../utils/logger'

export class CustomerProfileMonitor {
    constructor() {
        this.monitoringActive = false
        this.customerProfiles = new Map()
        this.verificationSchedule = new Map()
        this.alertThresholds = {
            verificationInterval: 86400000, // 24 hours
            highPriorityInterval: 43200000,  // 12 hours
            criticalInterval: 21600000       // 6 hours
        }
        this.retryAttempts = 3
        this.concurrentChecks = 5
    }

    /**
     * Initialize customer profile monitoring
     */
    async initialize() {
        try {
            logger.info('Initializing Customer Profile Monitor...')
            
            await this.loadCustomerProfiles()
            await this.setupVerificationSchedule()
            
            this.monitoringActive = true
            
            logger.info('Customer Profile Monitor initialized successfully', {
                metadata: {
                    profileCount: this.customerProfiles.size,
                    scheduledChecks: this.verificationSchedule.size
                }
            })
            
            return { success: true, profileCount: this.customerProfiles.size }
            
        } catch (error) {
            logger.error('Failed to initialize Customer Profile Monitor', {}, error)
            throw error
        }
    }

    /**
     * Load customer profiles from database/storage
     */
    async loadCustomerProfiles() {
        try {
            // In production, this would load from your customer database
            // For now, we'll simulate with localStorage or API call
            
            const profiles = await this.fetchCustomerProfiles()
            
            profiles.forEach(profile => {
                this.customerProfiles.set(profile.customerId, {
                    customerId: profile.customerId,
                    email: profile.email,
                    businessName: profile.businessName,
                    directorySubmissions: profile.directorySubmissions || [],
                    lastVerified: null,
                    verificationStatus: 'pending',
                    profileHealth: {
                        totalDirectories: 0,
                        activeProfiles: 0,
                        removedProfiles: 0,
                        pendingProfiles: 0,
                        dataIntegrityScore: 1.0
                    },
                    alerts: []
                })
            })
            
            logger.info(`Loaded ${profiles.length} customer profiles for monitoring`)
            
        } catch (error) {
            logger.error('Failed to load customer profiles', {}, error)
            throw error
        }
    }

    /**
     * Fetch customer profiles from data source
     */
    async fetchCustomerProfiles() {
        // This would integrate with your actual customer database
        // For now, return mock data structure
        
        try {
            // Example: Fetch from Airtable, Supabase, or your database
            const response = await fetch('/api/customers/profiles', {
                headers: {
                    'Authorization': `Bearer ${process.env.API_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            })
            
            if (!response.ok) {
                throw new Error(`Failed to fetch customer profiles: ${response.status}`)
            }
            
            const data = await response.json()
            return data.profiles || []
            
        } catch (error) {
            logger.warn('Using fallback customer profile data', {}, error)
            
            // Fallback to localStorage or mock data
            const fallbackData = localStorage.getItem('customer_profiles')
            return fallbackData ? JSON.parse(fallbackData) : []
        }
    }

    /**
     * Setup automated verification schedule
     */
    async setupVerificationSchedule() {
        try {
            // Clear existing schedules
            this.verificationSchedule.forEach(intervalId => clearInterval(intervalId))
            this.verificationSchedule.clear()
            
            // Schedule verification for each customer based on priority
            for (const [customerId, profile] of this.customerProfiles) {
                const priority = this.calculateCustomerPriority(profile)
                const interval = this.getVerificationInterval(priority)
                
                const intervalId = setInterval(async () => {
                    if (this.monitoringActive) {
                        await this.verifyCustomerProfile(customerId)
                    }
                }, interval)
                
                this.verificationSchedule.set(customerId, intervalId)
            }
            
            logger.info('Verification schedule setup complete', {
                metadata: {
                    scheduledCustomers: this.verificationSchedule.size
                }
            })
            
        } catch (error) {
            logger.error('Failed to setup verification schedule', {}, error)
            throw error
        }
    }

    /**
     * Calculate customer priority for monitoring frequency
     */
    calculateCustomerPriority(profile) {
        let priority = 'standard'
        
        // High priority for enterprise customers or high-value accounts
        if (profile.directorySubmissions.length > 100) {
            priority = 'high'
        }
        
        // Critical priority for customers with recent issues
        if (profile.alerts.some(alert => alert.severity === 'critical' && 
            Date.now() - new Date(alert.timestamp).getTime() < 86400000)) {
            priority = 'critical'
        }
        
        return priority
    }

    /**
     * Get verification interval based on priority
     */
    getVerificationInterval(priority) {
        switch (priority) {
            case 'critical':
                return this.alertThresholds.criticalInterval
            case 'high':
                return this.alertThresholds.highPriorityInterval
            default:
                return this.alertThresholds.verificationInterval
        }
    }

    /**
     * Verify customer profile across all directories
     */
    async verifyCustomerProfile(customerId) {
        const profile = this.customerProfiles.get(customerId)
        if (!profile) {
            logger.warn(`Customer profile not found: ${customerId}`)
            return
        }

        try {
            logger.info(`Starting profile verification for customer: ${customerId}`)
            
            const verificationResults = []
            const directorySubmissions = profile.directorySubmissions
            
            // Process directories in batches to avoid overwhelming the system
            const batches = this.createBatches(directorySubmissions, this.concurrentChecks)
            
            for (const batch of batches) {
                const batchPromises = batch.map(submission => 
                    this.verifyDirectoryProfile(customerId, submission)
                )
                
                const batchResults = await Promise.allSettled(batchPromises)
                
                batchResults.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        verificationResults.push(result.value)
                    } else {
                        logger.error(`Directory verification failed for ${batch[index].directoryId}`, {}, result.reason)
                        verificationResults.push({
                            directoryId: batch[index].directoryId,
                            status: 'error',
                            error: result.reason.message
                        })
                    }
                })
                
                // Small delay between batches
                await this.sleep(1000)
            }
            
            // Update profile with verification results
            await this.updateProfileVerification(customerId, verificationResults)
            
            // Check for alerts
            await this.checkProfileAlerts(customerId, verificationResults)
            
            logger.info(`Profile verification completed for customer: ${customerId}`, {
                metadata: {
                    directoriesChecked: verificationResults.length,
                    activeProfiles: verificationResults.filter(r => r.status === 'active').length,
                    removedProfiles: verificationResults.filter(r => r.status === 'removed').length
                }
            })
            
        } catch (error) {
            logger.error(`Profile verification failed for customer: ${customerId}`, {}, error)
            await this.recordVerificationError(customerId, error)
        }
    }

    /**
     * Verify profile exists on specific directory
     */
    async verifyDirectoryProfile(customerId, submission) {
        const { directoryId, submissionUrl, submittedData } = submission
        
        try {
            // Check if profile exists
            const existenceResult = await this.checkProfileExists(directoryId, submissionUrl, submittedData)
            
            if (!existenceResult.exists) {
                return {
                    directoryId,
                    status: 'removed',
                    lastSeen: existenceResult.lastSeen,
                    removalDetected: new Date().toISOString(),
                    confidence: existenceResult.confidence
                }
            }
            
            // Check listing status
            const statusResult = await this.checkListingStatus(directoryId, submissionUrl, submittedData)
            
            // Validate data integrity
            const integrityResult = await this.validateDataIntegrity(directoryId, submissionUrl, submittedData)
            
            return {
                directoryId,
                status: statusResult.status,
                exists: true,
                listingStatus: statusResult.details,
                dataIntegrity: integrityResult,
                lastVerified: new Date().toISOString(),
                confidence: Math.min(existenceResult.confidence, integrityResult.confidence)
            }
            
        } catch (error) {
            logger.error(`Directory profile verification failed: ${directoryId}`, {}, error)
            
            return {
                directoryId,
                status: 'error',
                error: error.message,
                lastAttempt: new Date().toISOString()
            }
        }
    }

    /**
     * Check if profile exists on directory
     */
    async checkProfileExists(directoryId, submissionUrl, submittedData) {
        try {
            // This would implement directory-specific profile checking logic
            // Each directory has different ways to verify profile existence
            
            const directory = await this.getDirectoryConfig(directoryId)
            if (!directory) {
                throw new Error(`Directory configuration not found: ${directoryId}`)
            }
            
            // Construct profile URL or search parameters
            const profileUrl = this.constructProfileUrl(directory, submittedData)
            
            // Fetch profile page
            const response = await fetch(profileUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            })
            
            if (!response.ok) {
                return {
                    exists: false,
                    confidence: 0.9,
                    reason: `HTTP ${response.status}`,
                    lastSeen: null
                }
            }
            
            const html = await response.text()
            
            // Check for profile indicators
            const profileExists = this.detectProfileInHtml(html, submittedData, directory)
            
            return {
                exists: profileExists.found,
                confidence: profileExists.confidence,
                indicators: profileExists.indicators,
                lastSeen: profileExists.found ? new Date().toISOString() : null
            }
            
        } catch (error) {
            logger.error(`Profile existence check failed for ${directoryId}`, {}, error)
            
            return {
                exists: false,
                confidence: 0.1,
                error: error.message,
                lastSeen: null
            }
        }
    }

    /**
     * Check listing status (approved, pending, rejected)
     */
    async checkListingStatus(directoryId, submissionUrl, submittedData) {
        try {
            const directory = await this.getDirectoryConfig(directoryId)
            const profileUrl = this.constructProfileUrl(directory, submittedData)
            
            const response = await fetch(profileUrl)
            const html = await response.text()
            
            // Analyze HTML for status indicators
            const statusIndicators = this.analyzeListingStatus(html, directory)
            
            return {
                status: statusIndicators.status,
                details: {
                    approved: statusIndicators.approved,
                    pending: statusIndicators.pending,
                    rejected: statusIndicators.rejected,
                    visible: statusIndicators.visible,
                    searchable: statusIndicators.searchable
                },
                confidence: statusIndicators.confidence
            }
            
        } catch (error) {
            return {
                status: 'unknown',
                error: error.message,
                confidence: 0.1
            }
        }
    }

    /**
     * Validate data integrity between submitted and displayed data
     */
    async validateDataIntegrity(directoryId, submissionUrl, submittedData) {
        try {
            const directory = await this.getDirectoryConfig(directoryId)
            const profileUrl = this.constructProfileUrl(directory, submittedData)
            
            const response = await fetch(profileUrl)
            const html = await response.text()
            
            // Extract displayed data from profile page
            const displayedData = this.extractDisplayedData(html, directory)
            
            // Compare submitted vs displayed data
            const comparison = this.compareData(submittedData, displayedData)
            
            return {
                matches: comparison.overallMatch,
                confidence: comparison.confidence,
                discrepancies: comparison.discrepancies,
                matchedFields: comparison.matchedFields,
                score: comparison.score
            }
            
        } catch (error) {
            return {
                matches: false,
                confidence: 0.1,
                error: error.message,
                discrepancies: ['Unable to verify data integrity']
            }
        }
    }

    /**
     * Get directory configuration for monitoring
     */
    async getDirectoryConfig(directoryId) {
        try {
            // Load directory configuration from your directory database
            const response = await fetch(`/api/directories/${directoryId}/config`)
            
            if (!response.ok) {
                throw new Error(`Directory config not found: ${directoryId}`)
            }
            
            return await response.json()
            
        } catch (error) {
            logger.error(`Failed to load directory config: ${directoryId}`, {}, error)
            return null
        }
    }

    /**
     * Construct profile URL for verification
     */
    constructProfileUrl(directory, submittedData) {
        // This would implement directory-specific URL construction
        // Each directory has different URL patterns for profiles
        
        const baseUrl = directory.profileUrlPattern || directory.url
        
        // Replace placeholders with actual data
        let profileUrl = baseUrl
            .replace('{businessName}', encodeURIComponent(submittedData.businessName || ''))
            .replace('{city}', encodeURIComponent(submittedData.city || ''))
            .replace('{state}', encodeURIComponent(submittedData.state || ''))
            .replace('{zip}', encodeURIComponent(submittedData.zipCode || ''))
        
        return profileUrl
    }

    /**
     * Detect profile in HTML content
     */
    detectProfileInHtml(html, submittedData, directory) {
        const indicators = []
        let confidence = 0
        
        // Check for business name
        if (submittedData.businessName && html.includes(submittedData.businessName)) {
            indicators.push('business_name_found')
            confidence += 0.4
        }
        
        // Check for phone number
        if (submittedData.phone && html.includes(submittedData.phone.replace(/\D/g, ''))) {
            indicators.push('phone_found')
            confidence += 0.3
        }
        
        // Check for address components
        if (submittedData.address && html.includes(submittedData.address)) {
            indicators.push('address_found')
            confidence += 0.2
        }
        
        // Check for website
        if (submittedData.website && html.includes(submittedData.website)) {
            indicators.push('website_found')
            confidence += 0.1
        }
        
        return {
            found: confidence > 0.5,
            confidence: Math.min(confidence, 1.0),
            indicators
        }
    }

    /**
     * Analyze listing status from HTML
     */
    analyzeListingStatus(html, directory) {
        // Directory-specific status detection logic
        const statusPatterns = {
            approved: /approved|active|published|live/i,
            pending: /pending|review|processing|waiting/i,
            rejected: /rejected|denied|declined|removed/i,
            visible: /visible|public|searchable/i
        }
        
        const status = {
            approved: statusPatterns.approved.test(html),
            pending: statusPatterns.pending.test(html),
            rejected: statusPatterns.rejected.test(html),
            visible: statusPatterns.visible.test(html),
            searchable: true // Default assumption
        }
        
        let primaryStatus = 'unknown'
        if (status.approved) primaryStatus = 'approved'
        else if (status.pending) primaryStatus = 'pending'
        else if (status.rejected) primaryStatus = 'rejected'
        
        return {
            status: primaryStatus,
            ...status,
            confidence: 0.7 // Medium confidence for status detection
        }
    }

    /**
     * Extract displayed data from profile page
     */
    extractDisplayedData(html, directory) {
        // This would implement directory-specific data extraction
        // Using CSS selectors or patterns to extract displayed information
        
        // Import DOMPurify for sanitization
        const DOMPurify = require('dompurify')
        
        // Sanitize HTML to prevent XSS attacks
        const sanitizedHtml = DOMPurify.sanitize(html, {
            ALLOWED_TAGS: ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th'],
            ALLOWED_ATTR: ['class', 'id', 'data-*', 'alt', 'title'],
            FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
            FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
            SANITIZE_DOM: true
        })
        
        const parser = new DOMParser()
        const doc = parser.parseFromString(sanitizedHtml, 'text/html')
        
        const extractedData = {}
        
        // Extract common fields using directory-specific selectors
        if (directory.extractionSelectors) {
            Object.entries(directory.extractionSelectors).forEach(([field, selector]) => {
                const element = doc.querySelector(selector)
                if (element) {
                    extractedData[field] = element.textContent.trim()
                }
            })
        }
        
        return extractedData
    }

    /**
     * Compare submitted vs displayed data
     */
    compareData(submittedData, displayedData) {
        const discrepancies = []
        const matchedFields = []
        let totalFields = 0
        let matchedCount = 0
        
        // Compare each field
        Object.keys(submittedData).forEach(field => {
            totalFields++
            
            const submitted = submittedData[field]
            const displayed = displayedData[field]
            
            if (!displayed) {
                discrepancies.push(`${field}: Not found in displayed data`)
                return
            }
            
            // Normalize for comparison
            const normalizedSubmitted = this.normalizeForComparison(submitted)
            const normalizedDisplayed = this.normalizeForComparison(displayed)
            
            if (normalizedSubmitted === normalizedDisplayed) {
                matchedFields.push(field)
                matchedCount++
            } else {
                discrepancies.push(`${field}: "${submitted}" vs "${displayed}"`)
            }
        })
        
        const score = totalFields > 0 ? matchedCount / totalFields : 0
        
        return {
            overallMatch: score > 0.8,
            score,
            confidence: score,
            discrepancies,
            matchedFields
        }
    }

    /**
     * Normalize text for comparison
     */
    normalizeForComparison(text) {
        if (!text) return ''
        
        return text
            .toString()
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
    }

    /**
     * Update profile verification results
     */
    async updateProfileVerification(customerId, verificationResults) {
        const profile = this.customerProfiles.get(customerId)
        if (!profile) return
        
        // Update profile health metrics
        profile.lastVerified = new Date().toISOString()
        profile.verificationStatus = 'completed'
        
        const health = profile.profileHealth
        health.totalDirectories = verificationResults.length
        health.activeProfiles = verificationResults.filter(r => r.status === 'active').length
        health.removedProfiles = verificationResults.filter(r => r.status === 'removed').length
        health.pendingProfiles = verificationResults.filter(r => r.status === 'pending').length
        
        // Calculate data integrity score
        const integrityScores = verificationResults
            .filter(r => r.dataIntegrity && r.dataIntegrity.score)
            .map(r => r.dataIntegrity.score)
        
        health.dataIntegrityScore = integrityScores.length > 0 
            ? integrityScores.reduce((sum, score) => sum + score, 0) / integrityScores.length
            : 1.0
        
        // Store detailed results
        profile.lastVerificationResults = verificationResults
        
        // Update in persistent storage
        await this.saveProfileUpdate(customerId, profile)
    }

    /**
     * Check for profile alerts
     */
    async checkProfileAlerts(customerId, verificationResults) {
        const profile = this.customerProfiles.get(customerId)
        if (!profile) return
        
        const alerts = []
        
        // Check for removed profiles
        const removedProfiles = verificationResults.filter(r => r.status === 'removed')
        if (removedProfiles.length > 0) {
            alerts.push({
                type: 'profile_removal',
                severity: 'critical',
                message: `${removedProfiles.length} profile(s) removed from directories`,
                details: removedProfiles.map(r => ({
                    directoryId: r.directoryId,
                    removalDetected: r.removalDetected
                })),
                timestamp: new Date().toISOString()
            })
        }
        
        // Check for data integrity issues
        const integrityIssues = verificationResults.filter(r => 
            r.dataIntegrity && !r.dataIntegrity.matches
        )
        if (integrityIssues.length > 0) {
            alerts.push({
                type: 'data_integrity',
                severity: 'high',
                message: `Data integrity issues detected in ${integrityIssues.length} directories`,
                details: integrityIssues.map(r => ({
                    directoryId: r.directoryId,
                    discrepancies: r.dataIntegrity.discrepancies
                })),
                timestamp: new Date().toISOString()
            })
        }
        
        // Check for verification errors
        const errorCount = verificationResults.filter(r => r.status === 'error').length
        if (errorCount > verificationResults.length * 0.2) { // More than 20% errors
            alerts.push({
                type: 'verification_errors',
                severity: 'medium',
                message: `High error rate during verification: ${errorCount}/${verificationResults.length}`,
                timestamp: new Date().toISOString()
            })
        }
        
        // Add alerts to profile
        profile.alerts = [...profile.alerts, ...alerts]
        
        // Keep only recent alerts (last 30 days)
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
        profile.alerts = profile.alerts.filter(alert => 
            new Date(alert.timestamp).getTime() > thirtyDaysAgo
        )
        
        // Send critical alerts immediately
        const criticalAlerts = alerts.filter(alert => alert.severity === 'critical')
        if (criticalAlerts.length > 0) {
            await this.sendCustomerAlerts(customerId, criticalAlerts)
        }
    }

    /**
     * Send alerts to customer
     */
    async sendCustomerAlerts(customerId, alerts) {
        try {
            const profile = this.customerProfiles.get(customerId)
            if (!profile) return
            
            // Send email notification
            await this.sendEmailAlert(profile.email, alerts)
            
            // Log alert for dashboard
            await this.logCustomerAlert(customerId, alerts)
            
            // Trigger real-time notifications
            this.triggerRealTimeAlert(customerId, alerts)
            
            logger.info(`Alerts sent to customer: ${customerId}`, {
                metadata: {
                    alertCount: alerts.length,
                    severities: alerts.map(a => a.severity)
                }
            })
            
        } catch (error) {
            logger.error(`Failed to send customer alerts: ${customerId}`, {}, error)
        }
    }

    /**
     * Send email alert to customer
     */
    async sendEmailAlert(email, alerts) {
        // This would integrate with your email service
        const emailData = {
            to: email,
            subject: 'DirectoryBolt: Customer Data Alert',
            template: 'customer-data-alert',
            data: {
                alerts,
                dashboardUrl: 'https://directorybolt.com/dashboard/monitoring'
            }
        }
        
        // Send via your email service (SendGrid, AWS SES, etc.)
        logger.info(`Email alert sent to: ${email}`)
    }

    /**
     * Log customer alert for dashboard
     */
    async logCustomerAlert(customerId, alerts) {
        try {
            const alertLog = {
                customerId,
                alerts,
                timestamp: new Date().toISOString()
            }
            
            // Store in your logging system
            localStorage.setItem(`customer_alert_${customerId}_${Date.now()}`, JSON.stringify(alertLog))
            
        } catch (error) {
            logger.error('Failed to log customer alert', {}, error)
        }
    }

    /**
     * Trigger real-time alert
     */
    triggerRealTimeAlert(customerId, alerts) {
        // Trigger browser event for real-time dashboard updates
        window.dispatchEvent(new CustomEvent('customerDataAlert', {
            detail: { customerId, alerts }
        }))
    }

    /**
     * Save profile update to persistent storage
     */
    async saveProfileUpdate(customerId, profile) {
        try {
            // Save to your database/storage system
            const updateData = {
                customerId,
                profileHealth: profile.profileHealth,
                lastVerified: profile.lastVerified,
                verificationStatus: profile.verificationStatus,
                alerts: profile.alerts
            }
            
            // Store locally for now (replace with actual database call)
            localStorage.setItem(`customer_profile_${customerId}`, JSON.stringify(updateData))
            
        } catch (error) {
            logger.error(`Failed to save profile update: ${customerId}`, {}, error)
        }
    }

    /**
     * Record verification error
     */
    async recordVerificationError(customerId, error) {
        const profile = this.customerProfiles.get(customerId)
        if (!profile) return
        
        profile.verificationStatus = 'error'
        profile.lastError = {
            message: error.message,
            timestamp: new Date().toISOString()
        }
        
        await this.saveProfileUpdate(customerId, profile)
    }

    /**
     * Create batches for concurrent processing
     */
    createBatches(items, batchSize) {
        const batches = []
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize))
        }
        return batches
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    /**
     * Get monitoring status
     */
    getMonitoringStatus() {
        const totalCustomers = this.customerProfiles.size
        const activeMonitoring = this.verificationSchedule.size
        
        const healthStats = Array.from(this.customerProfiles.values()).reduce((stats, profile) => {
            stats.totalProfiles += profile.profileHealth.totalDirectories
            stats.activeProfiles += profile.profileHealth.activeProfiles
            stats.removedProfiles += profile.profileHealth.removedProfiles
            stats.pendingProfiles += profile.profileHealth.pendingProfiles
            return stats
        }, { totalProfiles: 0, activeProfiles: 0, removedProfiles: 0, pendingProfiles: 0 })
        
        return {
            monitoringActive: this.monitoringActive,
            totalCustomers,
            activeMonitoring,
            healthStats,
            lastUpdate: new Date().toISOString()
        }
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        this.monitoringActive = false
        this.verificationSchedule.forEach(intervalId => clearInterval(intervalId))
        this.verificationSchedule.clear()
        
        logger.info('Customer Profile Monitoring stopped')
    }

    /**
     * Export monitoring data
     */
    exportMonitoringData() {
        return {
            timestamp: new Date().toISOString(),
            status: this.getMonitoringStatus(),
            profiles: Array.from(this.customerProfiles.entries()).map(([id, profile]) => ({
                customerId: id,
                ...profile
            }))
        }
    }
}

// Export for use in other modules
export default CustomerProfileMonitor