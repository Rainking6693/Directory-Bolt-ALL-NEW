import { createClient } from '@supabase/supabase-js'

interface FormChangeDetection {
  formId: string
  userId: string
  formData: Record<string, any>
  lastSaved: Date
  changeCount: number
  autoSaveEnabled: boolean
}

interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffFactor: number
  retryableErrors: string[]
}

interface ErrorContext {
  userId?: string
  action: string
  formId?: string
  metadata?: Record<string, any>
  timestamp: Date
  sessionId?: string
}

interface ErrorRecoveryStrategy {
  type: 'retry' | 'fallback' | 'manual' | 'ignore'
  autoExecute: boolean
  description: string
  action?: () => Promise<any>
}

interface FormValidationRule {
  field: string
  required?: boolean
  type?: 'email' | 'url' | 'number' | 'string'
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  customValidator?: (value: any) => string | null
}

export type { FormValidationRule }

export class EnhancedErrorHandler {
  private supabase: any
  private formChangeTracking = new Map<string, FormChangeDetection>()
  private retryConfigs = new Map<string, RetryConfig>()
  private autoSaveIntervals = new Map<string, NodeJS.Timeout>()

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Default retry configurations
    this.setupDefaultRetryConfigs()
  }

  /**
   * Setup default retry configurations for different operations
   */
  private setupDefaultRetryConfigs(): void {
    // Directory submission retries
    this.retryConfigs.set('directory_submission', {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2,
      retryableErrors: [
        'network_error',
        'timeout',
        'rate_limit',
        'server_error',
        'connection_failed'
      ]
    })

    // API call retries
    this.retryConfigs.set('api_call', {
      maxRetries: 5,
      baseDelay: 500,
      maxDelay: 5000,
      backoffFactor: 1.5,
      retryableErrors: [
        'network_error',
        'timeout',
        'rate_limit',
        'temporary_failure'
      ]
    })

    // File upload retries
    this.retryConfigs.set('file_upload', {
      maxRetries: 2,
      baseDelay: 2000,
      maxDelay: 8000,
      backoffFactor: 2,
      retryableErrors: [
        'upload_failed',
        'network_error',
        'timeout'
      ]
    })
  }

  /**
   * Track form changes for auto-save and recovery
   */
  trackFormChanges(
    formId: string,
    userId: string,
    formData: Record<string, any>,
    autoSaveEnabled = true
  ): void {
    const existing = this.formChangeTracking.get(formId)
    
    const tracking: FormChangeDetection = {
      formId,
      userId,
      formData: { ...formData },
      lastSaved: existing?.lastSaved || new Date(),
      changeCount: (existing?.changeCount || 0) + 1,
      autoSaveEnabled
    }

    this.formChangeTracking.set(formId, tracking)

    // Setup auto-save if enabled and not already setup
    if (autoSaveEnabled && !this.autoSaveIntervals.has(formId)) {
      const interval = setInterval(async () => {
        await this.autoSaveForm(formId)
      }, 30000) // Auto-save every 30 seconds

      this.autoSaveIntervals.set(formId, interval)
    }

    // Save change to database for recovery
    this.saveFormState(formId, userId, formData)
  }

  /**
   * Automatically save form data
   */
  private async autoSaveForm(formId: string): Promise<void> {
    const tracking = this.formChangeTracking.get(formId)
    if (!tracking || !tracking.autoSaveEnabled) return

    try {
      await (this.supabase as any)
        .from('form_auto_saves')
        .upsert({
          form_id: formId,
          user_id: tracking.userId,
          form_data: tracking.formData,
          saved_at: new Date().toISOString()
        }, {
          onConflict: 'form_id,user_id'
        })

      // Update last saved time
      tracking.lastSaved = new Date()
      this.formChangeTracking.set(formId, tracking)

      console.log(`Auto-saved form ${formId}`)
    } catch (error) {
      console.error(`Auto-save failed for form ${formId}:`, error)
    }
  }

  /**
   * Save form state to database
   */
  private async saveFormState(
    formId: string,
    userId: string,
    formData: Record<string, any>
  ): Promise<void> {
    try {
      await (this.supabase as any)
        .from('form_states')
        .upsert({
          form_id: formId,
          user_id: userId,
          form_data: formData,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'form_id,user_id'
        })
    } catch (error) {
      console.error('Failed to save form state:', error)
    }
  }

  /**
   * Recover form data from previous session
   */
  async recoverFormData(formId: string, userId: string): Promise<Record<string, any> | null> {
    try {
      const { data, error } = await (this.supabase as any)
        .from('form_auto_saves')
        .select('form_data, saved_at')
        .eq('form_id', formId)
        .eq('user_id', userId)
        .order('saved_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) return null

      // Check if the saved data is recent (within last 24 hours)
      const savedAt = new Date(data.saved_at)
      const isRecent = Date.now() - savedAt.getTime() < 24 * 60 * 60 * 1000

      return isRecent ? data.form_data : null
    } catch (error) {
      console.error('Failed to recover form data:', error)
      return null
    }
  }

  /**
   * Execute operation with automatic retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationType: string,
    context?: ErrorContext
  ): Promise<T> {
    const config = this.retryConfigs.get(operationType) || this.retryConfigs.get('api_call')!
    
    let lastError: Error | null = null
    let delay = config.baseDelay

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const result = await operation()
        
        // Log successful execution after retries
        if (attempt > 0) {
          await this.logError({
            message: `Operation succeeded after ${attempt} retries`,
            level: 'info',
            context: { ...context, attempt, operationType }
          })
        }

        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        // Check if error is retryable
        const isRetryable = this.isRetryableError(lastError, config.retryableErrors)
        
        if (!isRetryable || attempt === config.maxRetries) {
          // Log final failure
          await this.logError({
            message: `Operation failed after ${attempt} attempts: ${lastError.message}`,
            level: 'error',
            context: { 
              ...context, 
              attempt, 
              operationType,
              errorType: lastError.name,
              isRetryable
            }
          })
          break
        }

        // Log retry attempt
        await this.logError({
          message: `Retry attempt ${attempt + 1}/${config.maxRetries}: ${lastError.message}`,
          level: 'warn',
          context: { ...context, attempt: attempt + 1, operationType }
        })

        // Wait before retry with exponential backoff
        if (attempt < config.maxRetries) {
          await this.sleep(delay)
          delay = Math.min(delay * config.backoffFactor, config.maxDelay)
        }
      }
    }

    throw lastError
  }

  /**
   * Validate form data with comprehensive rules
   */
  validateForm(
    formData: Record<string, any>,
    rules: FormValidationRule[]
  ): { isValid: boolean; errors: Record<string, string[]> } {
    const errors: Record<string, string[]> = {}

    for (const rule of rules) {
      const value = formData[rule.field]
      const fieldErrors: string[] = []

      // Required field validation
      if (rule.required && (value === undefined || value === null || value === '')) {
        fieldErrors.push(`${rule.field} is required`)
      }

      // Skip other validations if field is empty and not required
      if (!value && !rule.required) continue

      // Type validation
      if (rule.type && value) {
        switch (rule.type) {
          case 'email':
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              fieldErrors.push(`${rule.field} must be a valid email address`)
            }
            break
          case 'url':
            try {
              new URL(value)
            } catch {
              fieldErrors.push(`${rule.field} must be a valid URL`)
            }
            break
          case 'number':
            if (isNaN(Number(value))) {
              fieldErrors.push(`${rule.field} must be a number`)
            }
            break
        }
      }

      // Length validation
      if (rule.minLength && value && value.length < rule.minLength) {
        fieldErrors.push(`${rule.field} must be at least ${rule.minLength} characters`)
      }

      if (rule.maxLength && value && value.length > rule.maxLength) {
        fieldErrors.push(`${rule.field} must not exceed ${rule.maxLength} characters`)
      }

      // Pattern validation
      if (rule.pattern && value && !rule.pattern.test(value)) {
        fieldErrors.push(`${rule.field} format is invalid`)
      }

      // Custom validation
      if (rule.customValidator && value) {
        const customError = rule.customValidator(value)
        if (customError) {
          fieldErrors.push(customError)
        }
      }

      if (fieldErrors.length > 0) {
        errors[rule.field] = fieldErrors
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    }
  }

  /**
   * Determine error recovery strategy
   */
  determineRecoveryStrategy(error: Error, context?: ErrorContext): ErrorRecoveryStrategy {
    const errorMessage = error.message.toLowerCase()

    // Network-related errors
    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return {
        type: 'retry',
        autoExecute: true,
        description: 'Network error detected. Retrying automatically...'
      }
    }

    // Rate limiting errors
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
      return {
        type: 'retry',
        autoExecute: true,
        description: 'Rate limit reached. Waiting before retry...'
      }
    }

    // Validation errors
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return {
        type: 'manual',
        autoExecute: false,
        description: 'Please check your input and try again.'
      }
    }

    // Authentication errors
    if (errorMessage.includes('auth') || errorMessage.includes('unauthorized')) {
      return {
        type: 'fallback',
        autoExecute: true,
        description: 'Authentication required. Redirecting to login...',
        action: async () => {
          // Redirect to login or refresh token
          window.location.href = '/login'
        }
      }
    }

    // Server errors
    if (errorMessage.includes('server') || errorMessage.includes('internal')) {
      return {
        type: 'retry',
        autoExecute: false,
        description: 'Server error encountered. You can try again or contact support.'
      }
    }

    // Default strategy
    return {
      type: 'manual',
      autoExecute: false,
      description: 'An unexpected error occurred. Please try again.'
    }
  }

  /**
   * Log error with context
   */
  private async logError(errorLog: {
    message: string
    level: 'error' | 'warn' | 'info'
    context?: any
  }): Promise<void> {
    try {
      await this.supabase
        .from('error_logs')
        .insert({
          message: errorLog.message,
          level: errorLog.level,
          context: errorLog.context || {},
          created_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('Failed to log error:', error)
    }

    // Also log to console
    console[errorLog.level](errorLog.message, errorLog.context)
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error, retryableErrors: string[]): boolean {
    const errorMessage = error.message.toLowerCase()
    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError.toLowerCase())
    )
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Clear form tracking
   */
  clearFormTracking(formId: string): void {
    const interval = this.autoSaveIntervals.get(formId)
    if (interval) {
      clearInterval(interval)
      this.autoSaveIntervals.delete(formId)
    }
    
    this.formChangeTracking.delete(formId)
  }

  /**
   * Get form change statistics
   */
  getFormChangeStats(formId: string): FormChangeDetection | null {
    return this.formChangeTracking.get(formId) || null
  }

  /**
   * Cleanup old form data
   */
  async cleanupOldFormData(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
      
      await Promise.all([
        this.supabase
          .from('form_auto_saves')
          .delete()
          .lt('saved_at', cutoffDate.toISOString()),
        
        this.supabase
          .from('form_states')
          .delete()
          .lt('updated_at', cutoffDate.toISOString())
      ])
    } catch (error) {
      console.error('Failed to cleanup old form data:', error)
    }
  }
}

export const enhancedErrorHandler = new EnhancedErrorHandler()

// Form validation rules examples
export const directorySubmissionValidationRules: FormValidationRule[] = [
  {
    field: 'businessName',
    required: true,
    minLength: 2,
    maxLength: 100
  },
  {
    field: 'businessEmail',
    required: true,
    type: 'email'
  },
  {
    field: 'businessWebsite',
    required: true,
    type: 'url'
  },
  {
    field: 'businessDescription',
    required: true,
    minLength: 50,
    maxLength: 500
  },
  {
    field: 'businessPhone',
    required: false,
    pattern: /^[\+]?[1-9][\d]{0,15}$/,
    customValidator: (value: string) => {
      if (value && value.length < 10) {
        return 'Phone number must be at least 10 digits'
      }
      return null
    }
  }
]
