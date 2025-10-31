'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

// Checkout step components
import { PackageSelection } from './PackageSelection'
import { AddOnsSelection } from './AddOnsSelection'
import { SubscriptionOption } from './SubscriptionOption'
import { OrderSummary } from './OrderSummary'
import { CheckoutProcessing } from './CheckoutProcessing'

// Type imports
import type { 
  DirectoryBoltPackages, 
  DirectoryBoltAddOns, 
  PackageId, 
  AddOnId 
} from '../../types/checkout'

// DirectoryBolt Package Definitions (Your Exact Pricing)
export const DIRECTORYBOLT_PACKAGES: DirectoryBoltPackages = {
  starter: {
    id: 'starter',
    name: 'Starter Intelligence',
    price: 149,
    directories: 100,
    description: 'AI Market Analysis + 100 Directory Submissions',
    features: [
      'AI Market Analysis (Worth $1,500)',
      '100 Directory Submissions (Worth $400)', 
      'Competitor Intelligence (Worth $800)',
      'Basic optimization reports',
      'Email support'
    ],
    popular: false
  },
  growth: {
    id: 'growth',
    name: 'Growth Intelligence',
    price: 299,
    directories: 250,
    description: 'Full AI Business Intelligence + 250 Premium Directories',
    features: [
      'Full AI Business Intelligence (Worth $2,000)',
      '250 Premium Directory Submissions (Worth $1,000)',
      'Advanced Competitor Analysis (Worth $1,200)',
      'Growth Strategy Reports (Worth $800)',
      'Priority support & optimization'
    ],
    popular: true
  },
  professional: {
    id: 'professional',
    name: 'Professional Intelligence',
    price: 499,
    directories: 400,
    description: 'Enterprise AI Intelligence + 400 Premium Directories',
    features: [
      'Enterprise AI Intelligence Suite (Worth $3,000)',
      '400 Premium Directory Network (Worth $1,500)',
      'Deep Market Intelligence (Worth $2,000)',
      'White-label Reports (Worth $1,000)',
      'Dedicated account manager'
    ],
    popular: false
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise Intelligence',
    price: 799,
    directories: 500,
    description: 'Complete AI Intelligence Platform + 500+ Directories',
    features: [
      'Complete AI Intelligence Platform (Worth $4,000)',
      '500+ Premium Directory Network (Worth $2,000)',
      'Advanced Market Intelligence (Worth $2,500)',
      'Custom White-label Reports (Worth $1,200)',
      'Dedicated success manager + SLA'
    ],
    popular: false
  }
}

export const DIRECTORYBOLT_ADD_ONS: DirectoryBoltAddOns = {
  fast_track: {
    id: 'fast_track',
    name: 'Fast-track Submission',
    price: 25,
    description: 'Complete your submissions in 1-2 business days instead of 5-7 days',
    icon: '⚡'
  },
  premium_directories: {
    id: 'premium_directories',
    name: 'Premium Directories Only',
    price: 15,
    description: 'Submit only to high-authority, premium directories (DA 70+)',
    icon: '👑'
  },
  manual_qa: {
    id: 'manual_qa',
    name: 'Manual QA Review',
    price: 10,
    description: 'Human quality assurance review of all submissions before going live',
    icon: '🔍'
  },
  csv_export: {
    id: 'csv_export',
    name: 'CSV Export',
    price: 9,
    description: 'Download detailed CSV report of all submissions and results',
    icon: '📊'
  }
}

// No subscription service - DirectoryBolt uses one-time payments only

interface CheckoutState {
  step: 'package' | 'addons' | 'summary' | 'processing'
  selectedPackage: PackageId | null
  selectedAddOns: AddOnId[]
  wantsSubscription?: boolean
  customerInfo: {
    email: string
    name: string
    businessName: string
    businessWebsite: string
  }
  pricing: {
    packagePrice: number
    addOnsPrice: number
    subscriptionPrice?: number
    totalOneTime: number
    monthlyRecurring?: number
  }
}

export default function DirectoryBoltCheckout() {
  const router = useRouter()
  const [isVisible, setIsVisible] = useState(false)
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({
    step: 'package',
    selectedPackage: null,
    selectedAddOns: [],
    wantsSubscription: false,
    customerInfo: {
      email: '',
      name: '',
      businessName: '',
      businessWebsite: ''
    },
    pricing: {
      packagePrice: 0,
      addOnsPrice: 0,
      subscriptionPrice: 0,
      totalOneTime: 0,
      monthlyRecurring: 0
    }
  })

  useEffect(() => {
    setIsVisible(true)
  }, [])

  // Calculate pricing whenever selections change
  useEffect(() => {
    const packagePrice = checkoutState.selectedPackage 
      ? DIRECTORYBOLT_PACKAGES[checkoutState.selectedPackage]?.price || 0 
      : 0

    const addOnsPrice = checkoutState.selectedAddOns.reduce((total, addOnId) => {
      return total + (DIRECTORYBOLT_ADD_ONS[addOnId as AddOnId]?.price || 0)
    }, 0)

    setCheckoutState(prev => ({
      ...prev,
      pricing: {
        packagePrice,
        addOnsPrice,
        totalOneTime: packagePrice + addOnsPrice
      }
    }))
  }, [checkoutState.selectedPackage, checkoutState.selectedAddOns])

  const handlePackageSelect = (packageId: string) => {
    setCheckoutState(prev => ({
      ...prev,
      selectedPackage: packageId as PackageId,
      step: 'addons'
    }))
  }

  const handleAddOnsComplete = (selectedAddOns: string[]) => {
    setCheckoutState(prev => ({
      ...prev,
      selectedAddOns: selectedAddOns as AddOnId[],
      step: 'summary'
    }))
  }

  const handleCustomerInfoUpdate = (customerInfo: CheckoutState['customerInfo']) => {
    setCheckoutState(prev => ({
      ...prev,
      customerInfo
    }))
  }

  const handleCheckout = async () => {
    setCheckoutState(prev => ({ ...prev, step: 'processing' }))
    
    try {
      // Create one-time payment checkout session
      const checkoutResponse = await fetch('/api/create-checkout-session-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          package: checkoutState.selectedPackage,
          addOns: checkoutState.selectedAddOns,
          customer_email: checkoutState.customerInfo.email,
          customer_name: checkoutState.customerInfo.name,
          success_url: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}&type=package`,
          cancel_url: `${window.location.origin}/checkout?cancelled=true`,
          metadata: {
            business_name: checkoutState.customerInfo.businessName,
            business_website: checkoutState.customerInfo.businessWebsite
          }
        })
      })

      const checkoutData = await checkoutResponse.json()

      if (checkoutData.success && checkoutData.data?.checkout_session?.url) {
        // If they want subscription, we'll handle that on the success page
        // For now, redirect to main checkout
        window.location.href = checkoutData.data.checkout_session.url
      } else {
        throw new Error('Failed to create checkout session')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      setCheckoutState(prev => ({ ...prev, step: 'summary' }))
      alert('There was an error processing your checkout. Please try again.')
    }
  }

  const handleGoBack = () => {
    const stepOrder = ['package', 'addons', 'summary']
    const currentIndex = stepOrder.indexOf(checkoutState.step)
    if (currentIndex > 0) {
      setCheckoutState(prev => ({
        ...prev,
        step: stepOrder[currentIndex - 1] as CheckoutState['step']
      }))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900">
      {/* Header */}
      <div className={`relative pt-8 pb-6 px-4 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-black text-white mb-2">
              DirectoryBolt Checkout
            </h1>
            <p className="text-secondary-300">
              Get your business listed in hundreds of directories
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center space-x-4 mb-8">
            {[
              { key: 'package', label: 'Package', icon: '📦' },
              { key: 'addons', label: 'Add-ons', icon: '⚡' },
              { key: 'summary', label: 'Review', icon: '✅' }
            ].map((stepInfo, index) => {
              const isActive = checkoutState.step === stepInfo.key
              const isCompleted = ['package', 'addons', 'summary'].indexOf(checkoutState.step) > index
              
              return (
                <div key={stepInfo.key} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                    isActive 
                      ? 'bg-volt-500 border-volt-500 text-secondary-900' 
                      : isCompleted 
                        ? 'bg-success-500 border-success-500 text-white'
                        : 'bg-secondary-800 border-secondary-600 text-secondary-400'
                  }`}>
                    <span className="text-sm font-bold">{stepInfo.icon}</span>
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    isActive ? 'text-volt-400' : isCompleted ? 'text-success-400' : 'text-secondary-400'
                  }`}>
                    {stepInfo.label}
                  </span>
                  {index < 2 && (
                    <div className={`ml-4 w-8 h-0.5 ${
                      isCompleted ? 'bg-success-500' : 'bg-secondary-600'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 pb-16">
        <div className="max-w-4xl mx-auto">
          {/* Step 1: Package Selection */}
          {checkoutState.step === 'package' && (
            <PackageSelection
              packages={DIRECTORYBOLT_PACKAGES}
              selectedPackage={checkoutState.selectedPackage}
              onPackageSelect={handlePackageSelect}
            />
          )}

          {/* Step 2: Add-Ons Selection */}
          {checkoutState.step === 'addons' && (
            <AddOnsSelection
              addOns={DIRECTORYBOLT_ADD_ONS}
              selectedAddOns={checkoutState.selectedAddOns}
              onComplete={handleAddOnsComplete}
              onGoBack={handleGoBack}
              selectedPackage={checkoutState.selectedPackage ? DIRECTORYBOLT_PACKAGES[checkoutState.selectedPackage] : DIRECTORYBOLT_PACKAGES.starter}
            />
          )}

          {/* Step 3: Order Summary & Checkout */}
          {checkoutState.step === 'summary' && (
            <OrderSummary
              checkoutState={checkoutState}
              packages={DIRECTORYBOLT_PACKAGES}
              addOns={DIRECTORYBOLT_ADD_ONS}
              onCustomerInfoUpdate={handleCustomerInfoUpdate}
              onCheckout={handleCheckout}
              onGoBack={handleGoBack}
            />
          )}

          {/* Step 5: Processing */}
          {checkoutState.step === 'processing' && (
            <CheckoutProcessing />
          )}
        </div>
      </div>
    </div>
  )
}