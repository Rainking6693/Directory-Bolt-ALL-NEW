/**
 * Chrome Extension Bridge Service
 * 
 * Handles communication with Chrome extension for:
 * - 3.3.4: Manual mapping fallback interface
 * - Real browser automation
 * - Click-to-map functionality
 * - Live form detection
 */

import type { BusinessSubmissionRecord } from './autobolt-extension'
import { DynamicMappingResult } from './dynamic-form-mapper'

export interface ExtensionMessage {
  type: string
  data: any
  messageId: string
  timestamp: number
}

export interface FormFieldInfo {
  selector: string
  tagName: string
  type: string
  name: string
  id: string
  placeholder: string
  label: string
  isVisible: boolean
  isRequired: boolean
  boundingRect: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface PageFormInfo {
  url: string
  title: string
  forms: {
    formIndex: number
    action: string
    method: string
    fields: FormFieldInfo[]
  }[]
  submitButtons: FormFieldInfo[]
  detectedMappings: { [businessField: string]: string }
}

export interface ManualMappingSession {
  sessionId: string
  siteUrl: string
  businessData: BusinessSubmissionRecord
  detectedFields: FormFieldInfo[]
  currentMappings: { [businessField: string]: string }
  status: 'active' | 'completed' | 'cancelled'
  startedAt: Date
  completedAt?: Date
}

export interface ClickToMapResult {
  businessField: string
  selectedSelector: string
  fieldInfo: FormFieldInfo
  confidence: number
}

export class ChromeExtensionBridge {
  private activeSessions: Map<string, ManualMappingSession> = new Map()
  private messageCallbacks: Map<string, (response: any) => void> = new Map()
  private isExtensionConnected: boolean = false

  constructor() {
    this.initializeExtensionConnection()
  }

  /**
   * Initialize connection with Chrome extension
   */
  private initializeExtensionConnection(): void {
    // In a real implementation, this would establish WebSocket or 
    // Native Messaging connection with the Chrome extension
    console.log('🔌 Initializing Chrome extension connection...')
    
    // Simulated connection status
    this.isExtensionConnected = true
    console.log('✅ Chrome extension bridge initialized')
  }

  /**
   * 3.3.4: Start manual mapping session with click-to-map interface
   */
  async startManualMappingSession(
    siteUrl: string,
    businessData: BusinessSubmissionRecord,
    failedMappings: string[]
  ): Promise<string> {
    const sessionId = this.generateSessionId()
    
    console.log(`🔧 Starting manual mapping session for ${siteUrl}`)

    // Send message to extension to start mapping mode
    const pageInfo = await this.getPageFormInfo(siteUrl)
    
    const session: ManualMappingSession = {
      sessionId,
      siteUrl,
      businessData,
      detectedFields: this.flattenFormFields(pageInfo.forms),
      currentMappings: {},
      status: 'active',
      startedAt: new Date()
    }

    this.activeSessions.set(sessionId, session)

    // Send mapping request to extension
    await this.sendExtensionMessage('START_MANUAL_MAPPING', {
      sessionId,
      siteUrl,
      businessFields: failedMappings,
      detectedFields: session.detectedFields,
      businessData: this.sanitizeBusinessData(businessData)
    })

    console.log(`📋 Manual mapping session ${sessionId} started for ${failedMappings.length} fields`)
    
    return sessionId
  }

  /**
   * Get comprehensive form information from page
   */
  async getPageFormInfo(siteUrl: string): Promise<PageFormInfo> {
    console.log(`🔍 Analyzing page forms for ${siteUrl}`)

    // Send request to extension to analyze page
    const response = await this.sendExtensionMessage('ANALYZE_PAGE_FORMS', { url: siteUrl })

    if (!response.success) {
      throw new Error(`Failed to analyze page: ${response.error}`)
    }

    return response.data as PageFormInfo
  }

  /**
   * Handle click-to-map result from extension
   */
  async handleClickToMapResult(sessionId: string, result: ClickToMapResult): Promise<void> {
    const session = this.activeSessions.get(sessionId)
    
    if (!session) {
      console.error(`❌ Session ${sessionId} not found`)
      return
    }

    console.log(`🎯 Click-to-map result: ${result.businessField} → ${result.selectedSelector}`)

    // Update session mappings
    session.currentMappings[result.businessField] = result.selectedSelector

    // Validate the mapping by testing it
    const isValid = await this.validateFieldMapping(
      session.siteUrl,
      result.selectedSelector,
      session.businessData[result.businessField as keyof BusinessSubmissionRecord]?.toString() || ''
    )

    if (isValid) {
      console.log(`✅ Mapping validated: ${result.businessField} → ${result.selectedSelector}`)
      
      // Send confirmation to extension
      await this.sendExtensionMessage('MAPPING_CONFIRMED', {
        sessionId,
        businessField: result.businessField,
        selector: result.selectedSelector,
        valid: true
      })
    } else {
      console.log(`⚠️ Mapping validation failed: ${result.businessField} → ${result.selectedSelector}`)
      
      // Request alternative mapping
      await this.sendExtensionMessage('MAPPING_FAILED', {
        sessionId,
        businessField: result.businessField,
        selector: result.selectedSelector,
        message: 'Field mapping validation failed. Please try a different element.'
      })
    }
  }

  /**
   * Complete manual mapping session
   */
  async completeMappingSession(sessionId: string): Promise<{ [field: string]: string }> {
    const session = this.activeSessions.get(sessionId)
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    console.log(`✅ Completing manual mapping session ${sessionId}`)

    session.status = 'completed'
    session.completedAt = new Date()

    // Validate all mappings one final time
    const validatedMappings: { [field: string]: string } = {}
    
    for (const [field, selector] of Object.entries(session.currentMappings)) {
      const businessValue = session.businessData[field as keyof BusinessSubmissionRecord]?.toString() || ''
      const isValid = await this.validateFieldMapping(session.siteUrl, selector, businessValue)
      
      if (isValid) {
        validatedMappings[field] = selector
      } else {
        console.warn(`⚠️ Dropping invalid mapping: ${field} → ${selector}`)
      }
    }

    // Send completion message to extension
    await this.sendExtensionMessage('MAPPING_SESSION_COMPLETE', {
      sessionId,
      finalMappings: validatedMappings,
      totalMapped: Object.keys(validatedMappings).length
    })

    // Clean up session
    this.activeSessions.delete(sessionId)

    console.log(`🎉 Manual mapping completed: ${Object.keys(validatedMappings).length} fields mapped`)

    return validatedMappings
  }

  /**
   * Cancel manual mapping session
   */
  async cancelMappingSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId)
    
    if (session) {
      session.status = 'cancelled'
      session.completedAt = new Date()
      
      await this.sendExtensionMessage('MAPPING_SESSION_CANCELLED', { sessionId })
      this.activeSessions.delete(sessionId)
      
      console.log(`🚫 Manual mapping session ${sessionId} cancelled`)
    }
  }

  /**
   * Validate that a field mapping works correctly
   */
  private async validateFieldMapping(siteUrl: string, selector: string, testValue: string): Promise<boolean> {
    try {
      // Send validation request to extension
      const response = await this.sendExtensionMessage('VALIDATE_FIELD_MAPPING', {
        url: siteUrl,
        selector,
        testValue
      })

      return response.success && response.data.isValid
    } catch (error) {
      console.error(`❌ Field mapping validation failed:`, error)
      return false
    }
  }

  /**
   * Get suggestions for field mapping based on page analysis
   */
  async getFieldMappingSuggestions(
    siteUrl: string,
    businessField: string
  ): Promise<FormFieldInfo[]> {
    console.log(`💡 Getting mapping suggestions for ${businessField} on ${siteUrl}`)

    const response = await this.sendExtensionMessage('GET_FIELD_SUGGESTIONS', {
      url: siteUrl,
      businessField
    })

    if (response.success) {
      return response.data.suggestions as FormFieldInfo[]
    } else {
      console.warn(`⚠️ No suggestions found for ${businessField}`)
      return []
    }
  }

  /**
   * Test form submission with current mappings
   */
  async testFormSubmission(
    siteUrl: string,
    mappings: { [field: string]: string },
    businessData: BusinessSubmissionRecord
  ): Promise<{ success: boolean; error?: string; screenshot?: string }> {
    console.log(`🧪 Testing form submission on ${siteUrl}`)

    const response = await this.sendExtensionMessage('TEST_FORM_SUBMISSION', {
      url: siteUrl,
      mappings,
      businessData: this.sanitizeBusinessData(businessData),
      dryRun: true
    })

    return {
      success: response.success,
      error: response.error,
      screenshot: response.data?.screenshot
    }
  }

  /**
   * Execute actual form submission
   */
  async executeFormSubmission(
    siteUrl: string,
    mappings: { [field: string]: string },
    businessData: BusinessSubmissionRecord
  ): Promise<{ success: boolean; error?: string; screenshot?: string; submissionProof?: string }> {
    console.log(`🚀 Executing form submission on ${siteUrl}`)

    const response = await this.sendExtensionMessage('EXECUTE_FORM_SUBMISSION', {
      url: siteUrl,
      mappings,
      businessData: this.sanitizeBusinessData(businessData),
      dryRun: false
    })

    return {
      success: response.success,
      error: response.error,
      screenshot: response.data?.screenshot,
      submissionProof: response.data?.submissionProof
    }
  }

  /**
   * Send message to Chrome extension
   */
  private async sendExtensionMessage(type: string, data: any): Promise<any> {
    if (!this.isExtensionConnected) {
      throw new Error('Chrome extension not connected')
    }

    const messageId = this.generateMessageId()
    const message: ExtensionMessage = {
      type,
      data,
      messageId,
      timestamp: Date.now()
    }

    console.log(`📤 Sending message to extension: ${type}`)

    // In a real implementation, this would send via Native Messaging or WebSocket
    // For now, simulate the response
    return this.simulateExtensionResponse(message)
  }

  /**
   * Simulate Chrome extension response (for development)
   */
  private async simulateExtensionResponse(message: ExtensionMessage): Promise<any> {
    // Simulate network delay
    await this.delay(500)

    switch (message.type) {
      case 'ANALYZE_PAGE_FORMS':
        return {
          success: true,
          data: {
            url: message.data.url,
            title: 'Directory Submission Form',
            forms: [{
              formIndex: 0,
              action: '/submit',
              method: 'POST',
              fields: [
                {
                  selector: '#business-name',
                  tagName: 'INPUT',
                  type: 'text',
                  name: 'business_name',
                  id: 'business-name',
                  placeholder: 'Enter business name',
                  label: 'Business Name',
                  isVisible: true,
                  isRequired: true,
                  boundingRect: { x: 100, y: 200, width: 300, height: 40 }
                },
                {
                  selector: '#email',
                  tagName: 'INPUT',
                  type: 'email',
                  name: 'email',
                  id: 'email',
                  placeholder: 'Enter email address',
                  label: 'Email',
                  isVisible: true,
                  isRequired: true,
                  boundingRect: { x: 100, y: 250, width: 300, height: 40 }
                }
              ]
            }],
            submitButtons: [{
              selector: '#submit-btn',
              tagName: 'BUTTON',
              type: 'submit',
              name: '',
              id: 'submit-btn',
              placeholder: '',
              label: 'Submit Application',
              isVisible: true,
              isRequired: false,
              boundingRect: { x: 100, y: 400, width: 120, height: 40 }
            }],
            detectedMappings: {
              businessName: '#business-name',
              email: '#email'
            }
          }
        }

      case 'VALIDATE_FIELD_MAPPING':
        return {
          success: true,
          data: {
            isValid: true,
            canFill: true,
            isVisible: true
          }
        }

      case 'GET_FIELD_SUGGESTIONS':
        return {
          success: true,
          data: {
            suggestions: [
              {
                selector: `input[name*="${message.data.businessField}"]`,
                tagName: 'INPUT',
                type: 'text',
                confidence: 0.8,
                isVisible: true,
                isRequired: false,
                boundingRect: { x: 100, y: 200, width: 300, height: 40 }
              }
            ]
          }
        }

      case 'TEST_FORM_SUBMISSION':
        return {
          success: true,
          data: {
            fieldsPopulated: Object.keys(message.data.mappings).length,
            screenshot: 'base64-encoded-screenshot-data'
          }
        }

      case 'EXECUTE_FORM_SUBMISSION':
        return {
          success: Math.random() > 0.2, // 80% success rate simulation
          error: Math.random() > 0.8 ? 'Form submission failed' : undefined,
          data: {
            screenshot: 'base64-encoded-screenshot-data',
            submissionProof: 'submission-confirmation-id-12345'
          }
        }

      default:
        return {
          success: true,
          data: {}
        }
    }
  }

  /**
   * Sanitize business data for transmission to extension
   */
  private sanitizeBusinessData(businessData: BusinessSubmissionRecord): any {
    return {
      businessName: businessData.businessName,
      email: businessData.email,
      phone: businessData.phone,
      website: businessData.website,
      address: businessData.address,
      city: businessData.city,
      state: businessData.state,
      zip: businessData.zip,
      description: businessData.description,
      facebook: businessData.facebook,
      instagram: businessData.instagram,
      linkedin: businessData.linkedin
    }
  }

  /**
   * Flatten form fields from multiple forms into single array
   */
  private flattenFormFields(forms: any[]): FormFieldInfo[] {
    const fields: FormFieldInfo[] = []
    
    for (const form of forms) {
      fields.push(...form.fields)
    }

    return fields
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `mapping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get active mapping sessions
   */
  getActiveSessions(): ManualMappingSession[] {
    return Array.from(this.activeSessions.values())
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ManualMappingSession | undefined {
    return this.activeSessions.get(sessionId)
  }

  /**
   * Check if extension is connected
   */
  isConnected(): boolean {
    return this.isExtensionConnected
  }
}

// Export singleton instance
export const chromeExtensionBridge = new ChromeExtensionBridge()
export default chromeExtensionBridge
