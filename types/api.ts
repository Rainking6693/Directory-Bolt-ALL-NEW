// API Types and Service Types
// Comprehensive type definitions for API responses and service configurations

// Plan capacity mappings with type safety
export interface PlanCapacities {
  starter: number
  growth: number
  pro: number
  subscription: number
}

export type PlanId = keyof PlanCapacities

// Difficulty level mappings
export interface DifficultyLevels {
  easy: number
  medium: number
  hard: number
}

export type DifficultyLevel = keyof DifficultyLevels

// AutoBolt response types
export interface AutoBoltResponse {
  success: boolean
  message?: string
  data?: any
  error?: string
  customerId?: string  // Add customerId as optional property
  queueId?: string
  estimatedCompletion?: string
}

// Queue management types
export interface QueueItem {
  id: string
  customerId?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  plan: PlanId
  addOns?: string[]
  createdAt: number
  updatedAt: number
}

// Enhanced error types for better error handling
export interface ApiError extends Error {
  status?: number
  code?: string
  details?: any
}

// Stripe payment intent type extension
export interface EnhancedPaymentIntent {
  amount?: number | null
  status?: string
  metadata?: Record<string, any>
}

// Session type with enhanced payment intent
export interface EnhancedSession {
  payment_intent?: EnhancedPaymentIntent
  customer_details?: any
  metadata?: Record<string, any>
}

// Business field mapping types
export interface BusinessFieldMapping {
  [businessField: string]: string[]
}

// Form field types for dynamic mapping
export interface FormField {
  name: string
  value: string | number
  type?: string
}

// Validation types
export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings?: string[]
}