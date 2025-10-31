'use client'
import { useState, useEffect } from 'react'
import { Transition } from '@headlessui/react'

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
}

interface CustomerOnboardingFormProps {
  onSubmit: (data: CustomerData) => void
  onPackageChange?: (packageId: string) => void
  loading?: boolean
  error?: string
  className?: string
}

const packages = [
  {
    id: 'starter',
    name: 'Starter',
    price: 29.99,
    directories: 50,
    features: [
      'Email support',
      'Standard processing',
      '85%+ approval rates',
      'Basic analytics'
    ],
    description: 'Perfect for small businesses getting started',
    recommended: false
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 79.99,
    directories: 200,
    features: [
      'Priority support',
      'Faster processing',
      'AI optimization',
      '400-600% ROI',
      'Advanced analytics'
    ],
    description: 'Most popular for growing businesses',
    recommended: true
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 149.99,
    directories: 500,
    features: [
      'Phone support',
      'Rush processing',
      'API access',
      'White-label reports',
      'Priority queue',
      '600-800% ROI'
    ],
    description: 'For established businesses and agencies',
    recommended: false
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 299.99,
    directories: 'Unlimited',
    features: [
      'Dedicated support',
      'White-glove service',
      'Custom integration',
      'SLA guarantee',
      'Account manager',
      'Custom reporting'
    ],
    description: 'For large organizations with complex needs',
    recommended: false
  }
]

const directoryCategories = [
  'Local Business',
  'Professional Services',
  'Technology',
  'Healthcare',
  'Retail',
  'Food & Beverage',
  'Real Estate',
  'Education',
  'Entertainment',
  'Non-profit',
  'Manufacturing',
  'E-commerce'
]

export default function CustomerOnboardingForm({
  onSubmit,
  onPackageChange,
  loading = false,
  error,
  className = ''
}: CustomerOnboardingFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<CustomerData>({
    firstName: '',
    lastName: '',
    businessName: '',
    businessEmail: '',
    businessWebsite: '',
    businessDescription: '',
    phoneNumber: '',
    selectedPackage: 'growth', // Default to most popular
    directoryCategories: []
  })
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({})
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
    // Notify parent of initial package selection
    if (onPackageChange) {
      onPackageChange(formData.selectedPackage)
    }
  }, [onPackageChange, formData.selectedPackage])

  const validateStep = (step: number): boolean => {
    const errors: {[key: string]: string} = {}

    if (step === 1) {
      if (!formData.firstName.trim()) errors.firstName = 'First name is required'
      if (!formData.lastName.trim()) errors.lastName = 'Last name is required'
      if (!formData.businessName.trim()) errors.businessName = 'Business name is required'
      if (!formData.businessEmail.trim()) {
        errors.businessEmail = 'Business email is required'
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.businessEmail)) {
        errors.businessEmail = 'Please enter a valid email address'
      }
      if (!formData.businessWebsite.trim()) {
        errors.businessWebsite = 'Business website is required'
      } else if (!/^https?:\/\/.+/.test(formData.businessWebsite)) {
        errors.businessWebsite = 'Please enter a valid website URL (including http:// or https://)'
      }
      if (!formData.businessDescription.trim()) {
        errors.businessDescription = 'Business description is required'
      } else if (formData.businessDescription.length < 50) {
        errors.businessDescription = 'Please provide at least 50 characters describing your business'
      }
    }

    if (step === 2) {
      if (!formData.selectedPackage) {
        errors.selectedPackage = 'Please select a package'
      }
    }

    if (step === 3) {
      if (formData.directoryCategories.length === 0) {
        errors.directoryCategories = 'Please select at least one directory category'
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleInputChange = (field: keyof CustomerData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handlePackageSelect = (packageId: string) => {
    handleInputChange('selectedPackage', packageId)
    if (onPackageChange) {
      onPackageChange(packageId)
    }
  }

  const handleCategoryToggle = (category: string) => {
    const categories = formData.directoryCategories.includes(category)
      ? formData.directoryCategories.filter(c => c !== category)
      : [...formData.directoryCategories, category]
    
    handleInputChange('directoryCategories', categories)
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 3))
    }
  }

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateStep(currentStep)) {
      onSubmit(formData)
    }
  }

  const selectedPackage = packages.find(pkg => pkg.id === formData.selectedPackage)

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">Get Started with DirectoryBolt</h2>
          <span className="text-sm text-secondary-400">Step {currentStep} of 3</span>
        </div>
        <div className="w-full bg-secondary-800 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-volt-500 to-volt-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${(currentStep / 3) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-secondary-400">
          <span className={currentStep >= 1 ? 'text-volt-400' : ''}>Business Info</span>
          <span className={currentStep >= 2 ? 'text-volt-400' : ''}>Package Selection</span>
          <span className={currentStep >= 3 ? 'text-volt-400' : ''}>Directory Preferences</span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-danger-900/20 border border-danger-500/30 rounded-lg">
          <p className="text-danger-400 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Business Information */}
        <Transition
          show={currentStep === 1}
          enter="transition-opacity duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="bg-secondary-800/50 p-6 rounded-xl border border-secondary-600">
            <h3 className="text-xl font-semibold text-volt-400 mb-6">Tell us about your business</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* First Name */}
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-secondary-300 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  className={`w-full px-4 py-3 bg-secondary-900 border rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent transition-all ${
                    formErrors.firstName ? 'border-danger-500' : 'border-secondary-600'
                  }`}
                  placeholder="Enter your first name"
                />
                {formErrors.firstName && (
                  <p className="mt-1 text-sm text-danger-400">{formErrors.firstName}</p>
                )}
              </div>

              {/* Last Name */}
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-secondary-300 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  className={`w-full px-4 py-3 bg-secondary-900 border rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent transition-all ${
                    formErrors.lastName ? 'border-danger-500' : 'border-secondary-600'
                  }`}
                  placeholder="Enter your last name"
                />
                {formErrors.lastName && (
                  <p className="mt-1 text-sm text-danger-400">{formErrors.lastName}</p>
                )}
              </div>

              {/* Business Name */}
              <div>
                <label htmlFor="businessName" className="block text-sm font-medium text-secondary-300 mb-2">
                  Business Name *
                </label>
                <input
                  type="text"
                  id="businessName"
                  value={formData.businessName}
                  onChange={(e) => handleInputChange('businessName', e.target.value)}
                  className={`w-full px-4 py-3 bg-secondary-900 border rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent transition-all ${
                    formErrors.businessName ? 'border-danger-500' : 'border-secondary-600'
                  }`}
                  placeholder="Your business name"
                />
                {formErrors.businessName && (
                  <p className="mt-1 text-sm text-danger-400">{formErrors.businessName}</p>
                )}
              </div>

              {/* Business Email */}
              <div>
                <label htmlFor="businessEmail" className="block text-sm font-medium text-secondary-300 mb-2">
                  Business Email *
                </label>
                <input
                  type="email"
                  id="businessEmail"
                  value={formData.businessEmail}
                  onChange={(e) => handleInputChange('businessEmail', e.target.value)}
                  className={`w-full px-4 py-3 bg-secondary-900 border rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent transition-all ${
                    formErrors.businessEmail ? 'border-danger-500' : 'border-secondary-600'
                  }`}
                  placeholder="contact@yourbusiness.com"
                />
                {formErrors.businessEmail && (
                  <p className="mt-1 text-sm text-danger-400">{formErrors.businessEmail}</p>
                )}
              </div>

              {/* Business Website */}
              <div>
                <label htmlFor="businessWebsite" className="block text-sm font-medium text-secondary-300 mb-2">
                  Business Website *
                </label>
                <input
                  type="url"
                  id="businessWebsite"
                  value={formData.businessWebsite}
                  onChange={(e) => handleInputChange('businessWebsite', e.target.value)}
                  className={`w-full px-4 py-3 bg-secondary-900 border rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent transition-all ${
                    formErrors.businessWebsite ? 'border-danger-500' : 'border-secondary-600'
                  }`}
                  placeholder="https://www.yourbusiness.com"
                />
                {formErrors.businessWebsite && (
                  <p className="mt-1 text-sm text-danger-400">{formErrors.businessWebsite}</p>
                )}
              </div>

              {/* Phone Number (Optional) */}
              <div>
                <label htmlFor="phoneNumber" className="block text-sm font-medium text-secondary-300 mb-2">
                  Phone Number <span className="text-secondary-500">(Optional)</span>
                </label>
                <input
                  type="tel"
                  id="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                  className="w-full px-4 py-3 bg-secondary-900 border border-secondary-600 rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent transition-all"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            {/* Business Description */}
            <div className="mt-6">
              <label htmlFor="businessDescription" className="block text-sm font-medium text-secondary-300 mb-2">
                Business Description *
              </label>
              <textarea
                id="businessDescription"
                rows={4}
                value={formData.businessDescription}
                onChange={(e) => handleInputChange('businessDescription', e.target.value)}
                className={`w-full px-4 py-3 bg-secondary-900 border rounded-lg text-white placeholder-secondary-400 focus:ring-2 focus:ring-volt-500 focus:border-transparent transition-all resize-none ${
                  formErrors.businessDescription ? 'border-danger-500' : 'border-secondary-600'
                }`}
                placeholder="Describe your business, services, and target market (minimum 50 characters)"
              />
              <div className="flex justify-between items-center mt-1">
                {formErrors.businessDescription ? (
                  <p className="text-sm text-danger-400">{formErrors.businessDescription}</p>
                ) : (
                  <p className="text-sm text-secondary-400">
                    {formData.businessDescription.length < 50 
                      ? `${50 - formData.businessDescription.length} characters remaining`
                      : 'Good to go!'
                    }
                  </p>
                )}
                <span className="text-xs text-secondary-500">
                  {formData.businessDescription.length}/500
                </span>
              </div>
            </div>
          </div>
        </Transition>

        {/* Step 2: Package Selection */}
        <Transition
          show={currentStep === 2}
          enter="transition-opacity duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="bg-secondary-800/50 p-6 rounded-xl border border-secondary-600">
            <h3 className="text-xl font-semibold text-volt-400 mb-2">Choose your plan</h3>
            <p className="text-secondary-300 mb-6">Select the package that best fits your business needs</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:scale-105 ${
                    formData.selectedPackage === pkg.id
                      ? 'border-volt-500 bg-volt-500/10 shadow-2xl shadow-volt-500/20'
                      : 'border-secondary-600 bg-secondary-800/50 hover:border-volt-500/50'
                  } ${pkg.recommended ? 'ring-2 ring-volt-500/30' : ''}`}
                  onClick={() => handlePackageSelect(pkg.id)}
                >
                  {pkg.recommended && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold px-4 py-1 rounded-full text-xs">
                        MOST POPULAR
                      </span>
                    </div>
                  )}
                  
                  <div className="text-center mb-4">
                    <h4 className="text-lg font-bold text-white mb-1">{pkg.name}</h4>
                    <div className="text-3xl font-black text-volt-400 mb-1">
                      ${pkg.price}
                      <span className="text-sm font-normal text-secondary-400">/mo</span>
                    </div>
                    <p className="text-sm text-secondary-300">
                      {typeof pkg.directories === 'number' ? `${pkg.directories} directories` : pkg.directories}
                    </p>
                  </div>

                  <ul className="space-y-2 mb-4">
                    {pkg.features.map((feature, index) => (
                      <li key={index} className="flex items-start text-sm text-secondary-300">
                        <span className="text-success-400 mr-2 mt-0.5">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <p className="text-xs text-secondary-400 text-center">{pkg.description}</p>

                  {formData.selectedPackage === pkg.id && (
                    <div className="absolute inset-0 border-2 border-volt-500 rounded-xl bg-volt-500/5 pointer-events-none flex items-center justify-center">
                      <div className="bg-volt-500 text-secondary-900 p-2 rounded-full">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {formErrors.selectedPackage && (
              <p className="mt-4 text-sm text-danger-400">{formErrors.selectedPackage}</p>
            )}
          </div>
        </Transition>

        {/* Step 3: Directory Preferences */}
        <Transition
          show={currentStep === 3}
          enter="transition-opacity duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="bg-secondary-800/50 p-6 rounded-xl border border-secondary-600">
            <h3 className="text-xl font-semibold text-volt-400 mb-2">Directory Categories</h3>
            <p className="text-secondary-300 mb-6">
              Select the categories that best describe your business. We'll prioritize directories in these areas.
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {directoryCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => handleCategoryToggle(category)}
                  className={`p-3 rounded-lg border-2 text-sm font-medium transition-all duration-200 ${
                    formData.directoryCategories.includes(category)
                      ? 'border-volt-500 bg-volt-500/10 text-volt-400'
                      : 'border-secondary-600 bg-secondary-800/50 text-secondary-300 hover:border-volt-500/50 hover:text-volt-400'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
            
            {formErrors.directoryCategories && (
              <p className="mt-4 text-sm text-danger-400">{formErrors.directoryCategories}</p>
            )}
            
            <div className="mt-6 p-4 bg-secondary-900/50 rounded-lg">
              <h4 className="font-medium text-white mb-2">Selected Categories:</h4>
              {formData.directoryCategories.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {formData.directoryCategories.map((category) => (
                    <span key={category} className="px-2 py-1 bg-volt-500/20 text-volt-400 rounded text-sm">
                      {category}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-secondary-400 text-sm">No categories selected yet</p>
              )}
            </div>
          </div>
        </Transition>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center pt-6">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={prevStep}
              className="px-6 py-3 border border-secondary-600 text-secondary-300 rounded-lg hover:border-secondary-500 hover:text-white transition-all"
            >
              Previous
            </button>
          ) : (
            <div></div>
          )}

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={nextStep}
              className="px-8 py-3 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold rounded-lg hover:from-volt-400 hover:to-volt-500 transition-all transform hover:scale-105"
            >
              Next Step →
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 font-bold rounded-lg hover:from-volt-400 hover:to-volt-500 transition-all transform hover:scale-105 disabled:opacity-75 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-secondary-900 border-t-transparent mr-2"></div>
                  Processing...
                </>
              ) : (
                'Complete Setup 🚀'
              )}
            </button>
          )}
        </div>

        {/* Summary */}
        {currentStep === 3 && selectedPackage && (
          <div className="mt-6 p-6 bg-volt-500/10 border border-volt-500/30 rounded-xl">
            <h4 className="font-semibold text-volt-400 mb-3">Order Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary-300">Name:</span>
                <span className="text-white">{formData.firstName} {formData.lastName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary-300">Business:</span>
                <span className="text-white">{formData.businessName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary-300">Package:</span>
                <span className="text-white">{selectedPackage.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary-300">Directories:</span>
                <span className="text-white">{selectedPackage.directories}</span>
              </div>
              <div className="flex justify-between font-semibold text-base pt-2 border-t border-volt-500/30">
                <span className="text-volt-400">Total:</span>
                <span className="text-volt-400">${selectedPackage.price}/month</span>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}