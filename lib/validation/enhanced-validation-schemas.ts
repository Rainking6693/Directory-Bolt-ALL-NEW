/**
 * Enhanced Validation Schemas using Valibot
 * Ultra-lightweight, type-safe validation with tree-shaking support
 */

import * as v from 'valibot'

// Business Information Schema with AI-enhanced validation
export const BusinessInfoSchema = v.object({
  businessName: v.pipe(
    v.string('Business name must be a string'),
    v.minLength(2, 'Business name must be at least 2 characters'),
    v.maxLength(100, 'Business name must be less than 100 characters'),
    v.regex(/^[a-zA-Z0-9\s&.,'-]+$/, 'Business name contains invalid characters')
  ),
  
  description: v.pipe(
    v.string('Description must be a string'),
    v.minLength(10, 'Description must be at least 10 characters'),
    v.maxLength(500, 'Description must be less than 500 characters')
  ),
  
  categories: v.pipe(
    v.array(v.string('Category must be a string')),
    v.minLength(1, 'At least one category is required'),
    v.maxLength(5, 'Maximum 5 categories allowed')
  ),
  
  website: v.optional(v.pipe(
    v.string('Website must be a string'),
    v.url('Please enter a valid URL')
  )),
  
  phone: v.pipe(
    v.string('Phone number must be a string'),
    v.regex(/^[\+]?[\d\s\-\(\)]{10,20}$/, 'Please enter a valid phone number')
  ),
  
  email: v.pipe(
    v.string('Email must be a string'),
    v.email('Please enter a valid email address')
  ),
  
  address: v.object({
    street: v.pipe(
      v.string('Street address must be a string'),
      v.minLength(5, 'Street address must be at least 5 characters'),
      v.maxLength(100, 'Street address must be less than 100 characters')
    ),
    city: v.pipe(
      v.string('City must be a string'),
      v.minLength(2, 'City must be at least 2 characters'),
      v.maxLength(50, 'City must be less than 50 characters'),
      v.regex(/^[a-zA-Z\s\-']+$/, 'City contains invalid characters')
    ),
    state: v.pipe(
      v.string('State must be a string'),
      v.minLength(2, 'State must be at least 2 characters'),
      v.maxLength(50, 'State must be less than 50 characters')
    ),
    zipCode: v.pipe(
      v.string('ZIP code must be a string'),
      v.regex(/^\d{5}(-\d{4})?$/, 'Please enter a valid ZIP code')
    ),
    country: v.pipe(
      v.string('Country must be a string'),
      v.minLength(2, 'Country must be at least 2 characters'),
      v.maxLength(50, 'Country must be less than 50 characters')
    )
  }),
  
  socialMedia: v.optional(v.object({
    facebook: v.optional(v.pipe(
      v.string('Facebook URL must be a string'),
      v.url('Please enter a valid Facebook URL'),
      v.regex(/^https?:\/\/(www\.)?(facebook|fb)\.com\//, 'Must be a valid Facebook URL')
    )),
    twitter: v.optional(v.pipe(
      v.string('Twitter URL must be a string'),
      v.url('Please enter a valid Twitter URL'),
      v.regex(/^https?:\/\/(www\.)?twitter\.com\//, 'Must be a valid Twitter URL')
    )),
    linkedin: v.optional(v.pipe(
      v.string('LinkedIn URL must be a string'),
      v.url('Please enter a valid LinkedIn URL'),
      v.regex(/^https?:\/\/(www\.)?linkedin\.com\//, 'Must be a valid LinkedIn URL')
    )),
    instagram: v.optional(v.pipe(
      v.string('Instagram URL must be a string'),
      v.url('Please enter a valid Instagram URL'),
      v.regex(/^https?:\/\/(www\.)?instagram\.com\//, 'Must be a valid Instagram URL')
    ))
  }))
})

// Directory Submission Schema with enhanced validation
export const DirectorySubmissionSchema = v.object({
  customerId: v.pipe(
    v.string('Customer ID must be a string'),
    v.regex(/^DIR-\d{8}-\d{6}$/, 'Invalid customer ID format')
  ),
  
  directoryId: v.pipe(
    v.string('Directory ID must be a string'),
    v.minLength(1, 'Directory ID is required')
  ),
  
  submissionData: v.object({
    businessName: v.pipe(
      v.string('Business name must be a string'),
      v.minLength(2, 'Business name must be at least 2 characters')
    ),
    description: v.pipe(
      v.string('Description must be a string'),
      v.minLength(10, 'Description must be at least 10 characters')
    ),
    category: v.string('Category must be a string'),
    website: v.optional(v.pipe(
      v.string('Website must be a string'),
      v.url('Please enter a valid URL')
    )),
    phone: v.pipe(
      v.string('Phone number must be a string'),
      v.regex(/^[\+]?[\d\s\-\(\)]{10,20}$/, 'Please enter a valid phone number')
    ),
    email: v.pipe(
      v.string('Email must be a string'),
      v.email('Please enter a valid email address')
    ),
    address: v.string('Address must be a string'),
    city: v.string('City must be a string'),
    state: v.string('State must be a string'),
    zipCode: v.string('ZIP code must be a string')
  }),
  
  status: v.picklist(['pending', 'submitted', 'approved', 'rejected'], 'Invalid status'),
  
  metadata: v.optional(v.object({
    submissionDate: v.pipe(
      v.string('Submission date must be a string'),
      v.isoDate('Please enter a valid ISO date')
    ),
    approvalDate: v.optional(v.pipe(
      v.string('Approval date must be a string'),
      v.isoDate('Please enter a valid ISO date')
    )),
    notes: v.optional(v.string('Notes must be a string')),
    retryCount: v.optional(v.pipe(
      v.number('Retry count must be a number'),
      v.minValue(0, 'Retry count cannot be negative'),
      v.maxValue(10, 'Maximum 10 retries allowed')
    ))
  }))
})

// AI Analysis Request Schema
export const AIAnalysisRequestSchema = v.object({
  websiteUrl: v.pipe(
    v.string('Website URL must be a string'),
    v.url('Please enter a valid URL'),
    v.regex(/^https?:\/\//, 'URL must start with http:// or https://')
  ),
  
  businessInfo: v.optional(BusinessInfoSchema),
  
  analysisType: v.picklist(
    ['basic', 'advanced', 'comprehensive', 'competitive'],
    'Invalid analysis type'
  ),
  
  options: v.optional(v.object({
    includeCompetitorAnalysis: v.optional(v.boolean('Must be a boolean')),
    includeSEOAnalysis: v.optional(v.boolean('Must be a boolean')),
    includeContentAnalysis: v.optional(v.boolean('Must be a boolean')),
    includePerformanceAnalysis: v.optional(v.boolean('Must be a boolean')),
    maxDirectories: v.optional(v.pipe(
      v.number('Max directories must be a number'),
      v.minValue(1, 'Must analyze at least 1 directory'),
      v.maxValue(500, 'Maximum 500 directories allowed')
    ))
  })),
  
  userTier: v.picklist(['free', 'basic', 'professional', 'enterprise'], 'Invalid user tier')
})

// Customer Creation Schema with enhanced validation
export const CustomerCreationSchema = v.object({
  firstName: v.pipe(
    v.string('First name must be a string'),
    v.minLength(1, 'First name is required'),
    v.maxLength(50, 'First name must be less than 50 characters'),
    v.regex(/^[a-zA-Z\s\-']+$/, 'First name contains invalid characters')
  ),
  
  lastName: v.pipe(
    v.string('Last name must be a string'),
    v.minLength(1, 'Last name is required'),
    v.maxLength(50, 'Last name must be less than 50 characters'),
    v.regex(/^[a-zA-Z\s\-']+$/, 'Last name contains invalid characters')
  ),
  
  email: v.pipe(
    v.string('Email must be a string'),
    v.email('Please enter a valid email address'),
    v.maxLength(255, 'Email must be less than 255 characters')
  ),
  
  businessInfo: BusinessInfoSchema,
  
  packageType: v.picklist(
    ['starter', 'growth', 'professional', 'enterprise'],
    'Invalid package type'
  ),
  
  agreedToTerms: v.pipe(
    v.boolean('Terms agreement must be a boolean'),
    v.literal(true, 'You must agree to the terms and conditions')
  ),
  
  marketingOptIn: v.optional(v.boolean('Marketing opt-in must be a boolean')),
  
  metadata: v.optional(v.object({
    source: v.optional(v.string('Source must be a string')),
    referrer: v.optional(v.string('Referrer must be a string')),
    campaign: v.optional(v.string('Campaign must be a string')),
    utmParams: v.optional(v.object({
      source: v.optional(v.string('UTM source must be a string')),
      medium: v.optional(v.string('UTM medium must be a string')),
      campaign: v.optional(v.string('UTM campaign must be a string')),
      term: v.optional(v.string('UTM term must be a string')),
      content: v.optional(v.string('UTM content must be a string'))
    }))
  }))
})

// Stripe Checkout Schema
export const StripeCheckoutSchema = v.object({
  priceId: v.pipe(
    v.string('Price ID must be a string'),
    v.regex(/^price_[a-zA-Z0-9]+$/, 'Invalid Stripe price ID format')
  ),
  
  customerId: v.optional(v.pipe(
    v.string('Customer ID must be a string'),
    v.regex(/^DIR-\d{8}-\d{6}$/, 'Invalid customer ID format')
  )),
  
  customerEmail: v.optional(v.pipe(
    v.string('Customer email must be a string'),
    v.email('Please enter a valid email address')
  )),
  
  successUrl: v.pipe(
    v.string('Success URL must be a string'),
    v.url('Please enter a valid success URL')
  ),
  
  cancelUrl: v.pipe(
    v.string('Cancel URL must be a string'),
    v.url('Please enter a valid cancel URL')
  ),
  
  metadata: v.optional(v.object({
    packageType: v.optional(v.string('Package type must be a string')),
    source: v.optional(v.string('Source must be a string')),
    campaignId: v.optional(v.string('Campaign ID must be a string'))
  })),
  
  allowPromotionCodes: v.optional(v.boolean('Allow promotion codes must be a boolean')),
  
  billingAddressCollection: v.optional(v.picklist(['auto', 'required'], 'Invalid billing address collection option'))
})

// API Response Schema for type safety
export const APIResponseSchema = v.object({
  success: v.boolean('Success must be a boolean'),
  data: v.optional(v.any()),
  error: v.optional(v.string('Error must be a string')),
  message: v.optional(v.string('Message must be a string')),
  timestamp: v.optional(v.pipe(
    v.string('Timestamp must be a string'),
    v.isoDate('Please enter a valid ISO date')
  )),
  requestId: v.optional(v.string('Request ID must be a string'))
})

// Enhanced validation helper functions
export class EnhancedValidator {
  static validateBusinessInfo(data: unknown) {
    return v.safeParse(BusinessInfoSchema, data)
  }
  
  static validateDirectorySubmission(data: unknown) {
    return v.safeParse(DirectorySubmissionSchema, data)
  }
  
  static validateAIAnalysisRequest(data: unknown) {
    return v.safeParse(AIAnalysisRequestSchema, data)
  }
  
  static validateCustomerCreation(data: unknown) {
    return v.safeParse(CustomerCreationSchema, data)
  }
  
  static validateStripeCheckout(data: unknown) {
    return v.safeParse(StripeCheckoutSchema, data)
  }
  
  static validateAPIResponse(data: unknown) {
    return v.safeParse(APIResponseSchema, data)
  }
  
  // Async validation with external checks
  static async validateBusinessAsync(data: unknown) {
    const baseValidation = this.validateBusinessInfo(data)
    
    if (!baseValidation.success) {
      return baseValidation
    }
    
    // Additional async validations
    const businessData = baseValidation.output
    const asyncChecks = await Promise.all([
      this.checkDuplicateBusiness(businessData.businessName),
      this.validateAddress(businessData.address),
      this.checkWebsiteAccessibility(businessData.website)
    ])
    
    const errors = asyncChecks.filter(check => !check.valid)
    
    if (errors.length > 0) {
      return {
        success: false,
        issues: errors.map(error => ({
          type: 'business_validation_error',
          message: error.message,
          input: data,
          requirement: error.requirement
        }))
      }
    }
    
    return {
      success: true,
      output: businessData,
      metadata: {
        validatedAt: new Date().toISOString(),
        checksPerformed: asyncChecks.length
      }
    }
  }
  
  private static async checkDuplicateBusiness(businessName: string) {
    // Simulate duplicate business check
    // In real implementation, this would check against database
    return {
      valid: true,
      message: 'Business name is unique',
      requirement: 'unique_business_name'
    }
  }
  
  private static async validateAddress(address: any) {
    // Simulate address validation
    // In real implementation, this would use a geocoding service
    return {
      valid: true,
      message: 'Address is valid',
      requirement: 'valid_address'
    }
  }
  
  private static async checkWebsiteAccessibility(website?: string) {
    if (!website) {
      return {
        valid: true,
        message: 'No website provided',
        requirement: 'optional_website'
      }
    }
    
    try {
      // Simulate website accessibility check
      // In real implementation, this would make an HTTP request
      return {
        valid: true,
        message: 'Website is accessible',
        requirement: 'accessible_website'
      }
    } catch (error) {
      return {
        valid: false,
        message: 'Website is not accessible',
        requirement: 'accessible_website'
      }
    }
  }
}

// Type exports for TypeScript integration
export type BusinessInfo = v.InferInput<typeof BusinessInfoSchema>
export type DirectorySubmission = v.InferInput<typeof DirectorySubmissionSchema>
export type AIAnalysisRequest = v.InferInput<typeof AIAnalysisRequestSchema>
export type CustomerCreation = v.InferInput<typeof CustomerCreationSchema>
export type StripeCheckout = v.InferInput<typeof StripeCheckoutSchema>
export type APIResponse = v.InferInput<typeof APIResponseSchema>