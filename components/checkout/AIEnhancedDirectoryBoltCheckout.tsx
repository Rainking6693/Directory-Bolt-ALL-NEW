'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

// Checkout step components
import { PackageSelection } from './PackageSelection'
import { AddOnsSelection } from './AddOnsSelection'
import { SubscriptionOption } from './SubscriptionOption'
import { OrderSummary } from './OrderSummary'
import { CheckoutProcessing } from './CheckoutProcessing'
import AIEnhancedBusinessForm from './AIEnhancedBusinessForm'
import BusinessProfileOptimizationWizard from './BusinessProfileOptimizationWizard'

// Type imports
import type { 
  DirectoryBoltPackages, 
  DirectoryBoltAddOns, 
  PackageId, 
  AddOnId 
} from '../../types/checkout'

// Import existing packages and add-ons
import { 
  DIRECTORYBOLT_PACKAGES, 
  DIRECTORYBOLT_ADD_ONS 
} from './DirectoryBoltCheckout'

// TODO: Replace with real service identifier or env var in Stage 7.x cleanup
const SUBSCRIPTION_SERVICE = {
  id: 'directorybolt-monitoring',
  name: 'DirectoryBolt Monitoring & Updates',
  price: 49,
  billing: 'month',
  description: 'Keep your directory listings active, accurate, and optimized with ongoing monitoring.',
  features: [
    'Automated listing monitoring',
    'Monthly accuracy audits',
    'Priority re-submission if listings drop',
    'Quarterly optimization recommendations'
  ],
}

interface EnhancedCheckoutState {
  step: 'package' | 'addons' | 'subscription' | 'business-form' | 'optimization' | 'summary' | 'processing'
  selectedPackage: PackageId | null
  selectedAddOns: AddOnId[]
  wantsSubscription: boolean
  customerInfo: {
    email: string
    name: string
    businessName: string
    businessWebsite: string
  }
  businessData?: any // Enhanced business information from AI form
  optimizedData?: any // Optimized data from the wizard
  pricing: {
    packagePrice: number
    addOnsPrice: number
    subscriptionPrice: number
    totalOneTime: number
    monthlyRecurring: number
  }
}

export default function AIEnhancedDirectoryBoltCheckout() {
  const router = useRouter()
  const [isVisible, setIsVisible] = useState(false)
  const [checkoutState, setCheckoutState] = useState<EnhancedCheckoutState>({
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
    businessData: undefined,
    optimizedData: undefined,
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

    const subscriptionPrice = checkoutState.wantsSubscription ? SUBSCRIPTION_SERVICE.price : 0

    setCheckoutState(prev => ({
      ...prev,
      pricing: {
        packagePrice,
        addOnsPrice,
        subscriptionPrice,
        totalOneTime: packagePrice + addOnsPrice,
        monthlyRecurring: subscriptionPrice
      }
    }))
  }, [checkoutState.selectedPackage, checkoutState.selectedAddOns, checkoutState.wantsSubscription])

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
      step: 'subscription'
    }))
  }

  const handleSubscriptionComplete = (wantsSubscription: boolean) => {
    setCheckoutState(prev => ({
      ...prev,
      wantsSubscription,
      step: 'business-form'
    }))
  }

  const handleBusinessFormComplete = (businessData: any) => {
    setCheckoutState(prev => ({
      ...prev,
      businessData,
      customerInfo: {
        ...prev.customerInfo,
        email: businessData.email || prev.customerInfo.email,
        name: prev.customerInfo.name, // Keep existing name or generate from business data
        businessName: businessData.businessName || prev.customerInfo.businessName,
        businessWebsite: businessData.website || prev.customerInfo.businessWebsite
      },
      step: 'optimization'
    }))
  }

  const handleOptimizationComplete = (optimizedData: any) => {
    setCheckoutState(prev => ({
      ...prev,
      optimizedData,
      step: 'summary'
    }))
  }

  const handleCustomerInfoUpdate = (customerInfo: EnhancedCheckoutState['customerInfo']) => {
    setCheckoutState(prev => ({
      ...prev,
      customerInfo
    }))
  }

  const handleCheckout = async () => {
    setCheckoutState(prev => ({ ...prev, step: 'processing' }))
    
    try {
      // Create enhanced checkout session with AI data
      const checkoutResponse = await fetch('/api/create-ai-enhanced-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          package: checkoutState.selectedPackage,
          addOns: checkoutState.selectedAddOns,
          customer_email: checkoutState.customerInfo.email,
          customer_name: checkoutState.customerInfo.name,
          success_url: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}&type=ai-enhanced`,
          cancel_url: `${window.location.origin}/checkout?cancelled=true`,
          metadata: {
            business_name: checkoutState.customerInfo.businessName,
            business_website: checkoutState.customerInfo.businessWebsite,
            wants_subscription: checkoutState.wantsSubscription.toString(),
            ai_enhanced: 'true',
            has_business_data: !!checkoutState.businessData,
            has_optimization_data: !!checkoutState.optimizedData
          },
          business_data: checkoutState.businessData,
          optimization_data: checkoutState.optimizedData
        })
      })

      const checkoutData = await checkoutResponse.json()

      if (checkoutData.success && checkoutData.data?.checkout_session?.url) {
        window.location.href = checkoutData.data.checkout_session.url
      } else {
        throw new Error('Failed to create checkout session')
      }
    } catch (error) {
      console.error('Enhanced checkout error:', error)
      setCheckoutState(prev => ({ ...prev, step: 'summary' }))
      alert('There was an error processing your checkout. Please try again.')
    }
  }

  const handleGoBack = () => {
    const stepOrder = ['package', 'addons', 'subscription', 'business-form', 'optimization', 'summary']
    const currentIndex = stepOrder.indexOf(checkoutState.step)
    if (currentIndex > 0) {
      setCheckoutState(prev => ({
        ...prev,
        step: stepOrder[currentIndex - 1] as EnhancedCheckoutState['step']
      }))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900">
      {/* Header */}
      <div className={`relative pt-8 pb-6 px-4 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-black text-white mb-2">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600">AI-Enhanced</span> DirectoryBolt
            </h1>
            <p className="text-secondary-300 text-lg">
              Get your business optimized and listed with the power of artificial intelligence
            </p>
          </div>

          {/* Enhanced Progress Indicator */}
          <div className="flex items-center justify-center space-x-2 md:space-x-4 mb-8 overflow-x-auto pb-2">
            {[
              { key: 'package', label: 'Package', icon: '📦' },
              { key: 'addons', label: 'Add-ons', icon: '⚡' },
              { key: 'subscription', label: 'Subscription', icon: '🔄' },
              { key: 'business-form', label: 'AI Form', icon: '🤖' },
              { key: 'optimization', label: 'Optimize', icon: '✨' },
              { key: 'summary', label: 'Review', icon: '✅' }
            ].map((stepInfo, index) => {
              const isActive = checkoutState.step === stepInfo.key
              const isCompleted = ['package', 'addons', 'subscription', 'business-form', 'optimization', 'summary'].indexOf(checkoutState.step) > index
              
              return (
                <div key={stepInfo.key} className="flex items-center flex-shrink-0">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                    isActive 
                      ? 'bg-volt-500 border-volt-500 text-secondary-900' 
                      : isCompleted 
                        ? 'bg-success-500 border-success-500 text-white'
                        : 'bg-secondary-800 border-secondary-600 text-secondary-400'
                  }`}>
                    <span className="text-sm font-bold">{stepInfo.icon}</span>
                  </div>
                  <div className="ml-2 flex flex-col">
                    <span className={`text-sm font-medium whitespace-nowrap ${
                      isActive ? 'text-volt-400' : isCompleted ? 'text-success-400' : 'text-secondary-400'
                    }`}>
                      {stepInfo.label}
                    </span>
                    {(stepInfo.key === 'business-form' || stepInfo.key === 'optimization') && (
                      <span className="text-xs text-volt-300">AI Powered</span>
                    )}
                  </div>
                  {index < 5 && (
                    <div className={`ml-4 w-6 md:w-8 h-0.5 ${
                      isCompleted ? 'bg-success-500' : 'bg-secondary-600'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Step description */}
          <div className="text-center mb-8">
            {checkoutState.step === 'business-form' && (
              <p className="text-secondary-300">
                🤖 Our AI will analyze your website and help pre-populate your business information
              </p>
            )}
            {checkoutState.step === 'optimization' && (
              <p className="text-secondary-300">
                ✨ Let our AI wizard optimize your business profile for maximum directory approval rates
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 pb-16">
        <div className="max-w-6xl mx-auto">
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

          {/* Step 3: Subscription Option */}
          {checkoutState.step === 'subscription' && (
            <SubscriptionOption
              subscription={SUBSCRIPTION_SERVICE}
              wantsSubscription={checkoutState.wantsSubscription}
              onComplete={handleSubscriptionComplete}
              onGoBack={handleGoBack}
            />
          )}

          {/* Step 4: AI-Enhanced Business Form */}
          {checkoutState.step === 'business-form' && (
            <AIEnhancedBusinessForm
              onSubmit={handleBusinessFormComplete}
              onBack={handleGoBack}
              initialWebsite={checkoutState.customerInfo.businessWebsite}
              className="animate-slide-up"
            />
          )}

          {/* Step 5: Business Profile Optimization Wizard */}
          {checkoutState.step === 'optimization' && (
            <BusinessProfileOptimizationWizard
              businessData={checkoutState.businessData}
              onOptimizationComplete={handleOptimizationComplete}
              onBack={handleGoBack}
              className="animate-slide-up"
            />
          )}

          {/* Step 6: Enhanced Order Summary & Checkout */}
          {checkoutState.step === 'summary' && (
            <div className="animate-slide-up">
              <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-black text-white mb-4">
                  Review Your
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-volt-400 to-volt-600"> AI-Enhanced Order</span>
                </h2>
                <p className="text-lg text-secondary-300">
                  Your business profile has been optimized with AI. Review your order below.
                </p>
              </div>

              {/* AI Enhancement Summary */}
              {(checkoutState.businessData || checkoutState.optimizedData) && (
                <div className="max-w-4xl mx-auto mb-8">
                  <div className="bg-gradient-to-r from-volt-500/10 to-success-500/10 border border-volt-500/30 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      🤖 AI Enhancement Summary
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="bg-secondary-800/50 rounded-lg p-4">
                        <div className="text-volt-400 font-semibold mb-1">Business Analysis</div>
                        <div className="text-secondary-300">
                          {checkoutState.businessData ? 'Complete ✓' : 'Standard'}
                        </div>
                      </div>
                      <div className="bg-secondary-800/50 rounded-lg p-4">
                        <div className="text-volt-400 font-semibold mb-1">Profile Optimization</div>
                        <div className="text-secondary-300">
                          {checkoutState.optimizedData ? 'AI Optimized ✓' : 'Standard'}
                        </div>
                      </div>
                      <div className="bg-secondary-800/50 rounded-lg p-4">
                        <div className="text-volt-400 font-semibold mb-1">Success Rate</div>
                        <div className="text-success-400 font-bold">
                          {checkoutState.optimizedData ? '85-95%' : '65-75%'}
                        </div>
                      </div>
                    </div>
                    {checkoutState.optimizedData && (
                      <div className="mt-4 p-3 bg-success-500/10 border border-success-500/30 rounded-lg">
                        <p className="text-success-300 text-sm">
                          🎉 Your profile has been AI-optimized for maximum directory approval rates!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Standard Order Summary */}
              <OrderSummary
                checkoutState={checkoutState}
                packages={DIRECTORYBOLT_PACKAGES}
                addOns={DIRECTORYBOLT_ADD_ONS}
                subscription={SUBSCRIPTION_SERVICE}
                onCustomerInfoUpdate={handleCustomerInfoUpdate}
                onCheckout={handleCheckout}
                onGoBack={handleGoBack}
              />
            </div>
          )}

          {/* Step 7: Processing */}
          {checkoutState.step === 'processing' && (
            <div className="animate-slide-up">
              <CheckoutProcessing />
              <div className="text-center mt-6">
                <p className="text-secondary-300 text-sm">
                  Processing your AI-enhanced directory submission package...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Enhancement Notice */}
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-volt-500/20 border border-volt-500/50 rounded-lg p-3 backdrop-blur-sm max-w-xs">
          <div className="flex items-center gap-2 text-volt-400 text-sm font-medium">
            <span>🤖</span>
            <span>AI Enhanced Experience</span>
          </div>
          <p className="text-secondary-300 text-xs mt-1">
            Your submissions are powered by advanced AI analysis
          </p>
        </div>
      </div>
    </div>
  )
}

// Export both versions for flexibility
export { default as StandardDirectoryBoltCheckout } from './DirectoryBoltCheckout'