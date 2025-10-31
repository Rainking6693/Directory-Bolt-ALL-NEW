// DirectoryBolt Checkout Types
// Comprehensive type definitions for checkout system

export interface DirectoryBoltPackage {
  id: string
  name: string
  price: number
  directories: number
  description: string
  features: string[]
  popular: boolean
}

export interface DirectoryBoltAddOn {
  id: string
  name: string
  price: number
  description: string
  icon: string
}

export interface SubscriptionService {
  id: string
  name: string
  price: number
  description: string
  features: string[]
}

// Type-safe package definitions
export type PackageId = 'starter' | 'growth' | 'professional' | 'enterprise'
export type AddOnId = 'fast_track' | 'premium_directories' | 'manual_qa' | 'csv_export'

// Mapped types for type-safe object access
export type DirectoryBoltPackages = Record<PackageId, DirectoryBoltPackage>
export type DirectoryBoltAddOns = Record<AddOnId, DirectoryBoltAddOn>

// Checkout state and pricing types
export interface CheckoutPricing {
  packagePrice: number
  addOnsPrice: number
  subscriptionPrice: number
  totalOneTime: number
  monthlyRecurring: number
}

export interface CheckoutState {
  currentStep: number
  selectedPackage: PackageId | null
  selectedAddOns: AddOnId[]
  wantsSubscription: boolean
  pricing: CheckoutPricing
}

// Success page plan info types
export interface SuccessPagePlan {
  name: string
  directories: number
  price: number
}

export interface SuccessPageAddOn {
  name: string
  icon: string
}

export type SuccessPagePlans = Record<PackageId, SuccessPagePlan>
export type SuccessPageAddOns = Record<AddOnId, SuccessPageAddOn>

// Customer data with proper typing
export interface CustomerData {
  email?: string
  name?: string
  company?: string
  website?: string
  selectedPackage?: PackageId
  selectedAddOns?: AddOnId[]
  wantsSubscription?: boolean
  sessionId?: string
  queueId?: string  // Add queueId as optional property
}

// Onboarding flow types
export interface OnboardingCustomerData extends CustomerData {
  queueId?: string
}