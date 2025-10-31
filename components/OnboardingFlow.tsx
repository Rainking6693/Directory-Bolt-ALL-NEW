'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Transition } from '@headlessui/react'
import CustomerOnboardingForm from './CustomerOnboardingForm'
import PackageSelector from './PackageSelector'
import CheckoutButton from './CheckoutButton'

interface CustomerData {
  firstName: string
  lastName: string
  businessName: string
  businessEmail: string
  businessWebsite: string
  businessDescription: string
  phoneNumber?: string
  selectedPackage: string
  directoryCategories: string[]
  sessionId?: string
  queueId?: string
}

interface OnboardingFlowProps {
  startingStep?: number
  onComplete?: (data: CustomerData & { sessionId?: string }) => void
  onStepChange?: (step: number) => void
  className?: string
}

type OnboardingStep = {
  id: number
  name: string
  title: string
  description: string
  component: 'form' | 'package' | 'payment'
  completed: boolean
}

const steps: OnboardingStep[] = [
  {
    id: 1,
    name: 'business-info',
    title: 'Business Information',
    description: 'Tell us about your business',
    component: 'form',
    completed: false
  },
  {
    id: 2,
    name: 'package-selection',
    title: 'Choose Package',
    description: 'Select your growth plan',
    component: 'package',
    completed: false
  },
  {
    id: 3,
    name: 'payment',
    title: 'Complete Purchase',
    description: 'Secure payment processing',
    component: 'payment',
    completed: false
  }
]

export default function OnboardingFlow({
  startingStep = 1,
  onComplete,
  onStepChange,
  className = ''
}: OnboardingFlowProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(startingStep)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [customerData, setCustomerData] = useState<CustomerData>({
    firstName: '',
    lastName: '',
    businessName: '',
    businessEmail: '',
    businessWebsite: '',
    businessDescription: '',
    phoneNumber: '',
    selectedPackage: 'growth',
    directoryCategories: []
  })
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [flowProgress, setFlowProgress] = useState(0)

  // Update progress based on current step and completed steps
  useEffect(() => {
    const progress = ((currentStep - 1) / (steps.length - 1)) * 100
    setFlowProgress(progress)
    
    if (onStepChange) {
      onStepChange(currentStep)
    }
  }, [currentStep, onStepChange])

  const handleFormSubmit = async (formData: CustomerData) => {
    try {
      setLoading(true)
      setError(undefined)

      // Simulate API call to save customer data
      await new Promise(resolve => setTimeout(resolve, 1000))

      setCustomerData(formData)
      setCompletedSteps(prev => new Set([...prev, 1]))
      setCurrentStep(2)
    } catch (err) {
      setError('Failed to save customer information. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePackageSelection = (packageId: string) => {
    setCustomerData(prev => ({ ...prev, selectedPackage: packageId }))
  }

  const handlePackageConfirm = () => {
    setCompletedSteps(prev => new Set([...prev, 2]))
    setCurrentStep(3)
  }

  const handlePaymentSuccess = async (paymentData: any) => {
    try {
      setLoading(true)
      
      // Submit to AutoBolt queue system
      const autoBoltPayload = {
        customer: {
          firstName: customerData.firstName,
          lastName: customerData.lastName,
          email: customerData.businessEmail,
          phone: customerData.phoneNumber,
          businessName: customerData.businessName,
          businessWebsite: customerData.businessWebsite,
          businessDescription: customerData.businessDescription
        },
        package: customerData.selectedPackage,
        categories: customerData.directoryCategories,
        paymentData: paymentData,
        billingCycle: billingCycle
      }

      // TODO: Replace with actual AutoBolt API call
      const response = await fetch('/api/autobolt/queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(autoBoltPayload)
      })

      if (!response.ok) {
        throw new Error('Failed to submit to processing queue')
      }

      const result = await response.json()
      
      setCompletedSteps(prev => new Set([...prev, 3]))
      
      if (onComplete) {
        onComplete({
          ...customerData,
          sessionId: paymentData.sessionId,
          queueId: result.queueId
        })
      }

      // Redirect to success page
      router.push(`/success?session_id=${paymentData.sessionId}&queue_id=${result.queueId}`)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment processing failed')
    } finally {
      setLoading(false)
    }
  }

  const handleStepNavigation = (stepNumber: number) => {
    // Only allow navigation to completed steps or the next step
    if (stepNumber <= currentStep || completedSteps.has(stepNumber - 1)) {
      setCurrentStep(stepNumber)
    }
  }

  const canNavigateToStep = (stepNumber: number) => {
    return stepNumber <= currentStep || completedSteps.has(stepNumber - 1)
  }

  return (
    <div className={`max-w-6xl mx-auto ${className}`}>
      {/* Progress Header */}
      <div className="mb-8 bg-secondary-800/50 p-6 rounded-xl border border-secondary-600">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-white">
            Welcome to DirectoryBolt
          </h1>
          <span className="text-sm text-secondary-400">
            Step {currentStep} of {steps.length}
          </span>
        </div>
        
        <p className="text-secondary-300 mb-6">
          Get your business listed in 480+ directories with our streamlined onboarding process.
        </p>

        {/* Progress Bar */}
        <div className="relative">
          <div className="w-full bg-secondary-700 rounded-full h-3 mb-4">
            <div 
              className="bg-gradient-to-r from-volt-500 to-volt-600 h-3 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${flowProgress}%` }}
            />
          </div>
          
          {/* Step Indicators */}
          <div className="flex justify-between">
            {steps.map((step) => {
              const isCompleted = completedSteps.has(step.id)
              const isCurrent = currentStep === step.id
              const canNavigate = canNavigateToStep(step.id)
              
              return (
                <button
                  key={step.id}
                  onClick={() => handleStepNavigation(step.id)}
                  disabled={!canNavigate}
                  className={`flex flex-col items-center transition-all duration-300 ${
                    canNavigate ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed opacity-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    isCompleted
                      ? 'bg-success-500 text-white'
                      : isCurrent
                      ? 'bg-volt-500 text-secondary-900 animate-pulse'
                      : 'bg-secondary-600 text-secondary-400'
                  }`}>
                    {isCompleted ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      step.id
                    )}
                  </div>
                  <div className="mt-2 text-center">
                    <div className={`text-xs font-medium ${
                      isCurrent ? 'text-volt-400' : isCompleted ? 'text-success-400' : 'text-secondary-400'
                    }`}>
                      {step.title}
                    </div>
                    <div className="text-xs text-secondary-500 mt-1 hidden sm:block">
                      {step.description}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-danger-900/20 border border-danger-500/30 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-danger-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-danger-400">{error}</p>
          </div>
          <button
            onClick={() => setError(undefined)}
            className="mt-2 text-danger-300 hover:text-danger-200 text-sm underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Step Content */}
      <div className="min-h-[600px]">
        {/* Step 1: Business Information Form */}
        <Transition
          show={currentStep === 1}
          enter="transition-all duration-500"
          enterFrom="opacity-0 translate-x-8"
          enterTo="opacity-100 translate-x-0"
          leave="transition-all duration-300"
          leaveFrom="opacity-100 translate-x-0"
          leaveTo="opacity-0 -translate-x-8"
        >
          <div>
            <CustomerOnboardingForm
              onSubmit={handleFormSubmit}
              onPackageChange={handlePackageSelection}
              loading={loading}
              error={error}
            />
          </div>
        </Transition>

        {/* Step 2: Package Selection */}
        <Transition
          show={currentStep === 2}
          enter="transition-all duration-500"
          enterFrom="opacity-0 translate-x-8"
          enterTo="opacity-100 translate-x-0"
          leave="transition-all duration-300"
          leaveFrom="opacity-100 translate-x-0"
          leaveTo="opacity-0 -translate-x-8"
        >
          <div className="bg-secondary-800/50 p-6 rounded-xl border border-secondary-600">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-2">Choose Your Package</h2>
              <p className="text-secondary-300">
                Select the plan that best fits your business needs
              </p>
            </div>

            <PackageSelector
              selectedPackage={customerData.selectedPackage}
              onPackageSelect={handlePackageSelection}
              billingCycle={billingCycle}
              onBillingCycleChange={setBillingCycle}
              showComparison={false}
            />

            <div className="flex justify-between items-center mt-8 pt-6 border-t border-secondary-600">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-6 py-3 border border-secondary-600 text-secondary-300 rounded-lg hover:border-secondary-500 hover:text-white transition-all"
              >
                ← Back to Business Info
              </button>
              
              <button
                onClick={handlePackageConfirm}
                className="px-8 py-3 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold rounded-lg hover:from-volt-400 hover:to-volt-500 transition-all transform hover:scale-105"
              >
                Continue to Payment →
              </button>
            </div>
          </div>
        </Transition>

        {/* Step 3: Payment */}
        <Transition
          show={currentStep === 3}
          enter="transition-all duration-500"
          enterFrom="opacity-0 translate-x-8"
          enterTo="opacity-100 translate-x-0"
          leave="transition-all duration-300"
          leaveFrom="opacity-100 translate-x-0"
          leaveTo="opacity-0 -translate-x-8"
        >
          <div className="bg-secondary-800/50 p-6 rounded-xl border border-secondary-600">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-volt-400 mb-2">Complete Your Order</h2>
              <p className="text-secondary-300">
                Secure payment processing powered by Stripe
              </p>
            </div>

            {/* Order Summary */}
            <div className="bg-volt-500/10 border border-volt-500/30 rounded-xl p-6 mb-8">
              <h3 className="font-semibold text-volt-400 mb-4">Order Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-secondary-300">Customer:</span>
                  <span className="text-white">{customerData.firstName} {customerData.lastName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-300">Business:</span>
                  <span className="text-white">{customerData.businessName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-300">Email:</span>
                  <span className="text-white">{customerData.businessEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-300">Package:</span>
                  <span className="text-white capitalize">{customerData.selectedPackage}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-300">Billing:</span>
                  <span className="text-white capitalize">{billingCycle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary-300">Categories:</span>
                  <span className="text-white">{customerData.directoryCategories.length} selected</span>
                </div>
                <div className="border-t border-volt-500/30 pt-3 mt-3">
                  <div className="flex justify-between font-semibold text-lg">
                    <span className="text-volt-400">Total:</span>
                    <span className="text-volt-400">
                      {/* Calculate price based on package and billing cycle */}
                      ${customerData.selectedPackage === 'starter' 
                        ? billingCycle === 'annual' ? '24.99' : '29.99'
                        : customerData.selectedPackage === 'growth'
                        ? billingCycle === 'annual' ? '66.66' : '79.99'
                        : customerData.selectedPackage === 'professional'
                        ? billingCycle === 'annual' ? '124.99' : '149.99'
                        : billingCycle === 'annual' ? '249.99' : '299.99'
                      }
                      /{billingCycle === 'annual' ? 'mo' : 'month'}
                    </span>
                  </div>
                  {billingCycle === 'annual' && (
                    <div className="text-success-400 text-sm text-right mt-1">
                      Save 17% with annual billing
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
              <button
                onClick={() => setCurrentStep(2)}
                className="w-full sm:w-auto px-6 py-3 border border-secondary-600 text-secondary-300 rounded-lg hover:border-secondary-500 hover:text-white transition-all"
              >
                ← Back to Packages
              </button>
              
              <div className="w-full sm:w-auto">
                <CheckoutButton
                  plan={customerData.selectedPackage}
                  customerEmail={customerData.businessEmail}
                  metadata={{
                    firstName: customerData.firstName,
                    lastName: customerData.lastName,
                    businessName: customerData.businessName,
                    businessWebsite: customerData.businessWebsite,
                    billingCycle: billingCycle,
                    directoryCategories: customerData.directoryCategories.join(',')
                  }}
                  onSuccess={handlePaymentSuccess}
                  onError={(error: { message: string }) => setError(error.message)}
                  loading={loading}
                  className="w-full text-center justify-center"
                  successUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/success?session_id={CHECKOUT_SESSION_ID}&plan=${customerData.selectedPackage}&onboarding=true`}
                  cancelUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/onboarding?step=3&cancelled=true`}
                >
                  Complete Purchase 🚀
                </CheckoutButton>
              </div>
            </div>

            {/* Security Notice */}
            <div className="mt-6 p-4 bg-secondary-900/50 rounded-lg text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <svg className="w-5 h-5 text-success-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium text-success-400">Secure Payment</span>
              </div>
              <p className="text-xs text-secondary-400">
                Your payment information is processed securely by Stripe. We don't store your payment details.
              </p>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  )
}